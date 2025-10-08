/* global logger */
/* global resBuilder */

let express = require('express');
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
        const {formName, formId, formData, processId, prevFormIds, userGroupName, userEmails} = req.body;

        if(!formName || !formId || !formData || formData.length === 0 || !processId || !userGroupName || userGroupName.length === 0) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        let userGroup = await postgres.UsersGroups.entity({name: userGroupName});

        if(!userGroup) {
            userGroup = await postgres.UsersGroups.create({name: userGroupName});
        }

        if(prevFormIds) {
            const existingPrevFormDependencies = await postgres.FormsDependencies.entities({processId: processId, formId: formId});

            for(let existingPrevFormDependency of existingPrevFormDependencies) {
                if(!prevFormIds.includes(existingPrevFormDependency.dataValues.prevFormId)) {
                    await existingPrevFormDependency.destroy();
                }
            }

            for(let prevFormId of prevFormIds.split(',')) {
                const prevForm = await postgres.Forms.entity({formId: prevFormId});

                if(!prevForm) {
                    const prevFormData = {
                        formName: "TempName",
                        formId: prevFormId,
                        formData: {"tempData": "tempData"},
                        processId: processId,
                        userGroupId: userGroup.dataValues.id,
                    }

                    await postgres.Forms.create(prevFormData);
                }

                const prevFormDependency = await postgres.FormsDependencies.entity({processId: processId, formId: formId, prevFormId: prevFormId});

                if(!prevFormDependency) {
                    await postgres.FormsDependencies.create({processId: processId, formId: formId, prevFormId: prevFormId});
                }
            }
        }

        const ifFormExists = await postgres.Forms.entity({formId: formId});
        const formssss = await postgres.Forms.entities();

        const process = await postgres.Processes.entity({id: processId});

        if(!process) {
            logger.error("Process not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        if(ifFormExists) {
            ifFormExists.formName = formName;
            ifFormExists.formData = formData;
            ifFormExists.userGroupId = userGroup.dataValues.id;
            ifFormExists.isStartingNode = !prevFormIds;
            ifFormExists.usersEmails = userEmails;

            await ifFormExists.save();

            await createUsersDependencies(userGroup.dataValues.id, userEmails, ifFormExists.dataValues.id);

            return res.status(200).json(resBuilder.success(ifFormExists));
        } else {
            const newFormData = {
                formName: formName,
                formId: formId,
                formData: formData,
                processId: processId,
                userGroupId: userGroup.dataValues.id,
                isStartingNode: !prevFormIds,
                usersEmails: userEmails,
            }

            const form = await postgres.Forms.create(newFormData);

            await createUsersDependencies(userGroup.dataValues.id, userEmails, form.dataValues.id);

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

async function createUsersDependencies(userGroupId, userEmails, formId) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emails = userEmails
        .split(',')
        .map(e => e.trim())
        .filter(Boolean)
        .filter(email => emailRegex.test(email));

    const userIds = [];
    for (const email of emails) {
        let user = await postgres.Users.entity({ email });
        if (!user) {
            user = await postgres.Users.create({ email, userGroupId });
        }
        userIds.push(user.dataValues.id);
    }

    const existingDeps = await postgres.UsersFormsDependencies.entities({ formId });

    for (const dep of existingDeps) {
        if (!userIds.includes(dep.dataValues.userId)) {
            await dep.destroy();
        }
    }

    const existingUserIds = existingDeps.map(dep => dep.dataValues.userId);
    for (const userId of userIds) {
        if (!existingUserIds.includes(userId)) {
            await postgres.UsersFormsDependencies.create({ formId, userId });
        }
    }
}

/* Put update form */
router.put('/:id', async function (req, res, next) {
    try {
        const formId = req.params.id;

        const form = await postgres.Forms.entity({id: formId});

        if(!form) {
            logger.error("Form not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const {formData, prevFormId, userGroupName} = req.body;

        if(!formData || formData.length === 0 || !userGroupName || userGroupName.length === 0) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        if(form) {
            return res.status(200).json(resBuilder.success(form));
        } else {
            return res.status(200).json(resBuilder.success("Form is not created"));
        }
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while updating form"));
    }
});

module.exports = router;
