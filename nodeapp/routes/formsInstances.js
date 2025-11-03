/* global logger */
/* global resBuilder */

let axios = require('axios');
let express = require('express');
const routesUtils = require("../utils/RoutesUtils");
let router = express.Router();
const formStatuses = require('../enums/FormStatuses');
const processInstances = require('../enums/ProcessesInstancesStatuses');
const {post} = require("axios");
const processesStatuses = require("../enums/FormStatuses");

/* GET all forms statuses */
router.get('/', async function (req, res, next) {
    try {
        const {eager, length, offset} = routesUtils.getDefaultRequestParams(req);

        const formsInstances = await postgres.FormsInstances.entities(null, eager, null, length, offset);
        return res.status(200).json(resBuilder.success(formsInstances));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all forms instances"));
    }
});

/* GET form status by id */
router.get('/:id', async function (req, res, next) {
    try {
        const {eager} = routesUtils.getDefaultRequestParams(req);

        const formInstanceId = req.params.id;
        const form = await postgres.Forms.entity({id: formInstanceId}, eager);

        if(!form) {
            logger.error("Form not found");
            return res.status(400).json(resBuilder.fail("Bad request."));
        }

        return res.status(200).json(resBuilder.success(form));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting form status by id"));
    }
});

/* POST create new form status or update form status*/
router.post('/', async function (req, res, next) {
    try {
        const {formData, formId, userId, processInstanceId} = req.body;

        if(!formData || formData.length === 0 || !formId || !userId) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const form = await postgres.Forms.entity({id: formId});
        const isFormStartingFormExists = await postgres.FormsDependencies.entities({formId: form.dataValues.formId});

        let isFormStartingForm = false;
        if(!isFormStartingFormExists || isFormStartingFormExists.length === 0) {
            isFormStartingForm = true;
        }

        const formInstanceId = form.dataValues.formId;

        if(isFormStartingForm && !processInstanceId) {
            const processStatusData = {
                "processId": form.dataValues.processId,
                "status": processInstances.PROCESSING,
                "initUserId": userId,
            }
            const processStatus = await postgres.ProcessesInstances.create(processStatusData);

            const formInstanceData = {
                formData: formData,
                formId: formId,
                formInstanceId: formInstanceId,
                filledUserId: userId,
                status: formStatuses.FILLED,
                webhookUrl: "empty",
                processInstanceId: processStatus.dataValues.id
            }
            const formInstance = await postgres.FormsInstances.create(formInstanceData);

            await createFollowUpFormsStatuses(formId, formInstanceId, processStatus.dataValues.id);

            return res.status(200).json(resBuilder.success(formInstance));
        } else if(!isFormStartingForm && processInstanceId) {
            let formInstance = await postgres.FormsInstances.entity({formInstanceId: formInstanceId, formId: formId, processInstanceId: processInstanceId});
            if(formInstance.dataValues.status !== formStatuses.WAITING) {
                logger.info("Form is not in waiting state, cannot be filled");
                return res.status(400).json(resBuilder.fail("Form is not in waiting state, cannot be filled"));
            }

            formInstance.formData = formData;
            formInstance.filledUserId = userId;
            formInstance.status = formStatuses.FILLED;

            await formInstance.save();

            const nextForms = await postgres.FormsDependencies.entities({prevFormId: formInstance.dataValues.formInstanceId});
            const nextFormsIds = [];

            for(let nextForm of nextForms) {
                nextFormsIds.push(nextForm.formId);
            }

            const nextWaitingFormsIds = [];
            for(let nextFormId of nextFormsIds) {
                let isPrevFormsFilled = true;
                const prevForms = await postgres.FormsDependencies.entities({formId: nextFormId});

                for(let prevForm of prevForms) {
                    const prevFormInstance = await postgres.FormsInstances.entity({formInstanceId: prevForm.dataValues.prevFormId, processInstanceId: processInstanceId});

                    if(prevFormInstance.dataValues.status !== formStatuses.FILLED) {
                        isPrevFormsFilled = false;
                        break;
                    }
                }

                if(isPrevFormsFilled) {
                    const nextForm = await postgres.FormsInstances.entity({formInstanceId: nextFormId, processInstanceId: processInstanceId});

                    nextForm.status = formStatuses.WAITING;
                    nextWaitingFormsIds.push({
                        "formProcessId": nextForm.dataValues.id,
                        "formInstanceId": nextForm.dataValues.formInstanceId,
                    });
                    await nextForm.save();
                }
            }

            await axios.post(
                formInstance.webhookUrl.replace('localhost', process.env.N8N_CONTAINER_NAME),
                {
                    "isFirstNode": false,
                    "nextNodesIds": nextWaitingFormsIds
                },
                {
                    auth: {
                        username: process.env.N8N_AUTH_USER,
                        password: process.env.N8N_AUTH_PASSWORD,
                    }
                }
            );

            await isProcessFinished(processInstanceId);

            return res.status(200).json(resBuilder.success(formInstance));
        } else {
            logger.error(`Process ID: ${processInstanceId}, is start form? ${isFormStartingForm}`);
            return res.status(400).json(resBuilder.fail("Bad request"));
        }
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while creating a new form"));
    }
});

/* POST create new form status or update form status*/
router.post('/webhookUrl', async function (req, res, next) {
    try {
        const {resumeUrl, formInstanceId, formProcessId} = req.body;

        if(!resumeUrl || !formInstanceId || !formProcessId) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const formInstance = await postgres.FormsInstances.entity({id: formProcessId, formInstanceId: formInstanceId});

        if(!formInstance) {
            logger.error("Form instance not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        formInstance.webhookUrl = resumeUrl;
        await formInstance.save();

        return res.status(200).json(resBuilder.success(formInstance));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while creating a new form"));
    }
});

async function createFollowUpFormsStatuses(filledFormId, formInstanceId, processStatusId) {
    const form = await postgres.Forms.entity({id: filledFormId});

    const processId = form.dataValues.processId;

    const processForms = await postgres.Forms.entities({processId: processId});

    const nextForms = await postgres.FormsDependencies.entities({prevFormId: formInstanceId});

    const nextFormIds = [];

    for(let nextForm of nextForms) {
        nextFormIds.push(nextForm.dataValues.formId);
    }

    const nextNodesIds = [];
    for(let processForm of processForms) {
        if(processForm.dataValues.id === filledFormId) {
            continue;
        }

        let formStatus = formStatuses.INACTIVE;

        let webhookUrl = "temp";
        if(nextFormIds.includes(processForm.dataValues.formId)) {
            formStatus = formStatuses.WAITING;
        }

        const newFormInstanceData = {
            formData: {},
            formInstanceId: processForm.dataValues.formId,
            status: formStatus,
            formId: processForm.id,
            webhookUrl: webhookUrl,
            processInstanceId: processStatusId
        }

        const newFormInstance = await postgres.FormsInstances.create(newFormInstanceData);
        if(newFormInstance.dataValues.status === formStatuses.WAITING) {
            nextNodesIds.push({
                "formProcessId": newFormInstance.dataValues.id,
                "formInstanceId": newFormInstance.dataValues.formInstanceId
            });
        }
    }
    const n8nWebhookUrl = `${process.env.N8N_BASE_URL}webhook/${formInstanceId}/start`;
    await axios.post(
        n8nWebhookUrl,
        {
            "isFirstNode": true,
            "nextNodesIds": nextNodesIds
        },
        {
            auth: {
                username: process.env.N8N_AUTH_USER,
                password: process.env.N8N_AUTH_PASSWORD,
            }
        }
    );
}

async function isProcessFinished(processInstanceId) {
    const forms = await postgres.FormsInstances.entities({ processInstanceId: processInstanceId });
    const isAnyFormsNotFilled = forms.filter(formInstance => formInstance.status !== formStatuses.FILLED);
    console.log(isAnyFormsNotFilled);
    if(isAnyFormsNotFilled.length === 0) {
        const processInstance = await postgres.ProcessesInstances.entity({ id: processInstanceId });
        processInstance.status = processInstances.ENDED;
        await processInstance.save();
    }
}

module.exports = router;