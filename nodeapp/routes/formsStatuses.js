/* global logger */
/* global resBuilder */

let axios = require('axios');
let express = require('express');
const routesUtils = require("../utils/RoutesUtils");
let router = express.Router();
const formStatuses = require('../enums/FormStatuses');
const processStatuses = require('../enums/ProcessesStatusesStatuses');
const {post} = require("axios");

/* GET all forms statuses */
router.get('/', async function (req, res, next) {
    try {
        const {eager, length, offset} = routesUtils.getDefaultRequestParams(req);

        const formsStatuses = await postgres.FormsStatuses.entities(null, eager, null, length, offset);
        return res.status(200).json(resBuilder.success(formsStatuses));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all forms statuses"));
    }
});

/* GET form status by id */
router.get('/:id', async function (req, res, next) {
    try {
        const {eager} = routesUtils.getDefaultRequestParams(req);

        const formStatusId = req.params.id;
        const formStatus = await postgres.Forms.entity({id: formStatusId}, eager);

        if(!formStatus) {
            logger.error("Form status not found");
            return res.status(400).json(resBuilder.fail("Bad request."));
        }

        return res.status(200).json(resBuilder.success(formStatus));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting form status by id"));
    }
});

/* POST create new form status or update form status*/
router.post('/', async function (req, res, next) {
    try {
        const {formData, formId, userId, processStatusId} = req.body;

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

        const formStatusId = form.dataValues.formId;

        if(isFormStartingForm && !processStatusId) {
            const processStatusData = {
                "processId": form.dataValues.processId,
                "status": processStatuses.PROCESSING,
                "initUserId": userId,
            }
            const processStatus = await postgres.ProcessesStatuses.create(processStatusData);

            const formStatusData = {
                formData: formData,
                formId: formId,
                formStatusId: formStatusId,
                filledUserId: userId,
                status: formStatuses.FILLED,
                webhookUrl: "empty",
                processStatusId: processStatus.dataValues.id
            }
            const formStatus = await postgres.FormsStatuses.create(formStatusData);

            await createFollowUpFormsStatuses(formId, formStatusId, processStatus.dataValues.id);

            return res.status(200).json(resBuilder.success(formStatus));
        } else if(!isFormStartingForm && processStatusId) {
            let formStatus = await postgres.FormsStatuses.entity({formStatusId: formStatusId, formId: formId, processStatusId: processStatusId});
            if(formStatus.dataValues.status !== formStatuses.WAITING) {
                logger.info("Form is not in waiting state, cannot be filled");
                return res.status(400).json(resBuilder.fail("Form is not in waiting state, cannot be filled"));
            }

            formStatus.formData = formData;
            formStatus.filledUserId = userId;
            formStatus.status = formStatuses.FILLED;

            await formStatus.save();

            const nextForms = await postgres.FormsDependencies.entities({prevFormId: formStatus.dataValues.formStatusId});
            const nextFormsIds = [];

            for(let nextForm of nextForms) {
                nextFormsIds.push(nextForm.formId);
            }

            const nextWaitingFormsIds = [];
            for(let nextFormId of nextFormsIds) {
                let isPrevFormsFilled = true;
                const prevForms = await postgres.FormsDependencies.entities({formId: nextFormId});

                for(let prevForm of prevForms) {
                    const prevFormStatus = await postgres.FormsStatuses.entity({formStatusId: prevForm.dataValues.prevFormId, processStatusId: processStatusId});

                    if(prevFormStatus.dataValues.status !== formStatuses.FILLED) {
                        isPrevFormsFilled = false;
                        break;
                    }
                }

                if(isPrevFormsFilled) {
                    const nextForm = await postgres.FormsStatuses.entity({formStatusId: nextFormId, processStatusId: processStatusId});

                    nextForm.status = formStatuses.WAITING;
                    nextWaitingFormsIds.push({
                        "formProcessId": nextForm.dataValues.id,
                        "formStatusId": nextForm.dataValues.formStatusId,
                    });
                    await nextForm.save();
                }
            }

            await axios.post(
                formStatus.webhookUrl.replace('localhost', process.env.N8N_CONTAINER_NAME),
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

            return res.status(200).json(resBuilder.success(formStatus));
        } else {
            logger.error(`Process ID: ${processStatusId}, is start form? ${isFormStartingForm}`);
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
        const {resumeUrl, formStatusId, formProcessId} = req.body;

        if(!resumeUrl || !formStatusId || !formProcessId) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        if(!formProcessId) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const formStatus = await postgres.FormsStatuses.entity({id: formProcessId, formStatusId: formStatusId});

        if(!formStatus) {
            logger.error("Form status not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        formStatus.webhookUrl = resumeUrl;
        await formStatus.save();

        return res.status(200).json(resBuilder.success(formStatus));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while creating a new form"));
    }
});

async function createFollowUpFormsStatuses(filledFormId, formStatusId, processStatusId) {
    const form = await postgres.Forms.entity({id: filledFormId});

    const processId = form.dataValues.processId;

    const processForms = await postgres.Forms.entities({processId: processId});

    const nextForms = await postgres.FormsDependencies.entities({prevFormId: formStatusId});

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

        const newFormStatusData = {
            formData: {},
            formStatusId: processForm.dataValues.formId,
            status: formStatus,
            formId: processForm.id,
            webhookUrl: webhookUrl,
            processStatusId: processStatusId
        }

        const newFormStatus = await postgres.FormsStatuses.create(newFormStatusData);
        if(newFormStatus.dataValues.status === formStatuses.WAITING) {
            nextNodesIds.push({
                "formProcessId": newFormStatus.dataValues.id,
                "formStatusId": newFormStatus.dataValues.formStatusId
            });
        }
    }
    const n8nWebhookUrl = `${process.env.N8N_BASE_URL}webhook/${formStatusId}`;
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

module.exports = router;