/* global logger */
/* global resBuilder */

let express = require('express');
const FormController = require("../oldstuff/FormController");
const routesUtils = require("../utils/RoutesUtils");
let router = express.Router();

/* GET all forms */
router.get('/', async function (req, res, next) {
    try {
        const {eager, length, offset} = routesUtils.getDefaultRequestParams(req);

        const forms = await postgres.Forms.entities(null, eager, null, length, offset);
        return res.status(200).json(resBuilder.success(forms));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all forms"));
    }
});

/* GET form by id */
router.get('/:id', async function (req, res, next) {
    try {
        const {eager} = routesUtils.getDefaultRequestParams(req);

        const formId = req.params.id;
        const form = await postgres.Forms.entity({id: formId}, eager);

        if(!form) {
            logger.error("Form not found");
            return res.status(400).json(resBuilder.fail("Bad request."));
        }

        return res.status(200).json(resBuilder.success(form));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting form by id"));
    }
});

/* POST create new form */
router.post('/', async function (req, res, next) {
    try {
        const {formName, formId, formData, processId, prevFormIds, userGroupName} = req.body;

        if(!formName || !formId || !formData || formData.length === 0 || !processId || !userGroupName || userGroupName.length === 0) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        let userGroup = await postgres.UsersGroups.entity({name: userGroupName});

        if(!userGroup) {
            userGroup = await postgres.UsersGroups.create({name: userGroupName});
        }

        if(prevFormIds) {
            for(let prevFormId of prevFormIds.split(',')) {
                const prevForm = await postgres.Forms.entity({formId: prevFormId});

                if(!prevForm) {
                    const prevFormData = {
                        formName: "TempName",
                        formId: prevFormId,
                        formData: {"tempData": "tempData"},
                        processId: processId,
                        prevFormId: null,
                        userGroupId: userGroup.dataValues.id,
                    }

                    await postgres.Forms.create(prevFormData);
                }

                const prevFormDependency = await postgres.FormsDependencies.entity({processId: processId, formId: prevFormId, prevFormId: formId});

                if(!prevFormDependency) {
                    await postgres.FormsDependencies.create({processId: processId, formId: prevFormId, prevFormId: formId});
                }
            }
        }

        const ifFormExists = await postgres.Forms.entity({formId: formId});

        const process = await postgres.Processes.entity({id: processId});

        if(!process) {
            logger.error("Process not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        if(ifFormExists) {
            ifFormExists.formName = formName;
            ifFormExists.formData = formData;
            ifFormExists.userGroupId = userGroup.dataValues.id;

            await ifFormExists.save();
            return res.status(200).json(resBuilder.success(ifFormExists));
        } else {
            const newFormData = {
                formName: formName,
                formId: formId,
                formData: formData,
                processId: processId,
                userGroupId: userGroup.dataValues.id,
            }

            const form = await postgres.Forms.create(newFormData);

            if(form) {
                return res.status(200).json(resBuilder.success(form));
            } else {
                return res.status(200).json(resBuilder.success("Form is not created"));
            }
        }
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while creating a new form"));
    }
});