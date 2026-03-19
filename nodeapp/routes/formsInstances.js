/* global logger */
/* global resBuilder */

let axios = require('axios');
let express = require('express');
const routesUtils = require("../utils/RoutesUtils");
let router = express.Router();
const formStatuses = require('../enums/FormStatuses');
const processInstances = require('../enums/ProcessesInstancesStatuses');
const {Op} = require("sequelize");

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

/* GET all available forms instances */
router.get('/available', async function (req, res) {
    try {
        const { eager, length, offset } = routesUtils.getDefaultRequestParams(req);
        const { formId, processInstanceId } = req.query;

        const currentUser = await postgres.Users.entity({ id: req.userId });
        const userGroupId = currentUser ? currentUser.userGroupId : null;

        let filters;
        if(formId && processInstanceId) {
            filters = { status: formStatuses.WAITING, formId: formId, processInstanceId: processInstanceId };
        } else {
            filters = { status: formStatuses.WAITING };
        }

        let formsInstances = await postgres.FormsInstances.entities(filters, eager, null, length, offset);

        const uid = parseInt(req.userId);
        const gid = userGroupId ? parseInt(userGroupId) : null;

        formsInstances = formsInstances.filter(fi => {
            const ids = (fi.assigneeId || []).map(Number);
            if (fi.instanceAssigneeType === "group") {
                return gid !== null && ids.includes(gid);
            }
            return ids.includes(uid);
        });

        if (formsInstances.length === 0) {
            return res.status(200).json(resBuilder.success([]));
        }

        const formIds = [...new Set(formsInstances.map(fi => fi.formId))];
        const processInstanceIds = [...new Set(formsInstances.map(fi => fi.dataValues.processInstanceId))];

        const forms = await postgres.Forms.entities({ id: formIds }, true);
        const formsMap = {};
        forms.forEach(f => formsMap[f.id] = f);

        const processIds = [...new Set(forms.map(f => f.Processes.id))];
        const startingForms = await postgres.Forms.entities({ isStartingNode: true, processId: processIds });
        const startingFormsMap = {};
        startingForms.forEach(sf => startingFormsMap[sf.processId] = sf);

        const startingFormIds = startingForms.map(sf => sf.id);
        const startingInstances = await postgres.FormsInstances.entities({
            formId: startingFormIds,
            processInstanceId: processInstanceIds
        });
        const startingInstancesMap = {};
        startingInstances.forEach(si => startingInstancesMap[si.processInstanceId] = si);

        const userIds = startingInstances.map(si => si.dataValues.filledUserId);
        const users = await postgres.Users.entities({ id: userIds });
        const usersMap = {};
        users.forEach(u => usersMap[u.id] = u);

        for(let fi of formsInstances) {
            const form = formsMap[fi.formId];
            fi.dataValues.name = `${form.Processes.name}/${form.formName}`;
            fi.dataValues.id = form.id;
            fi.dataValues.formData = JSON.parse(JSON.stringify(form.formData));

            if(fi.dataValues.instanceAssigneeType === "individual_emails") {
                const formAssignee = await postgres.FormsAssignees.entity({formId: fi.formId, userId: fi.dataValues.assigneeId[0]});
                fi.dataValues.formData.forEach(fd => {
                    fd.groupName = `${fd.groupName}/${formAssignee.dataValues.accompanyingText}`;
                })
            }

            const startingInstance = startingInstancesMap[fi.dataValues.processInstanceId];
            const initialUser = usersMap[startingInstance.dataValues.filledUserId];
            fi.dataValues.initialUserName = initialUser ? initialUser.dataValues.name : null;
        }

        return res.status(200).json(resBuilder.success(formsInstances));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all available forms instances"));
    }
});

/* GET all previous forms instances */
router.get('/previous', async function (req, res) {
    try {
        const { eager, length, offset } = routesUtils.getDefaultRequestParams(req);
        const { processInstanceId, formId } = req.query;

        let currentFormInstance = await postgres.FormsInstances.entity({ processInstanceId: processInstanceId, formId: formId }, eager, null, length, offset);

        if(!currentFormInstance) {
            return res.status(200).json(resBuilder.success([]));
        }

        const previousFormsIds = await getAllPrevFormIds(currentFormInstance.formInstanceId);
        const previousFormsInstances = await postgres.FormsInstances.entities({formInstanceId: { [Op.in]: previousFormsIds }, processInstanceId: processInstanceId}, true);

        previousFormsInstances.map(f => {
            f.dataValues.formName = f.dataValues.form.formName;
            delete f.dataValues.form;
            delete f.dataValues.processInstance;
            delete f.dataValues.user;
        });

        return res.status(200).json(resBuilder.success(previousFormsInstances));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all previous forms instances"));
    }
});

/* GET all filled forms instances */
router.get('/filled/:id', async function (req, res) {
    try {
        const { eager, length, offset } = routesUtils.getDefaultRequestParams(req);
        const id = req.params.id;

        let filledFormInstance = await postgres.FormsInstances.entity({ id: id }, true, null, length, offset);

        if(!filledFormInstance) {
            return res.status(200).json(resBuilder.success([]));
        }

        const startingFormNode = await postgres.Forms.entity({ isStartingNode: true, processId: filledFormInstance.dataValues.form.processId });
        const firstFilledFormInstance = await postgres.FormsInstances.entity({formId: startingFormNode.dataValues.id, processInstanceId: filledFormInstance.dataValues.processInstanceId});
        const user = await postgres.Users.entity({id: firstFilledFormInstance.dataValues.filledUserId});

        filledFormInstance.dataValues.formName = filledFormInstance.dataValues.form.formName;
        filledFormInstance.dataValues.initialUserName = user.dataValues.name;

        delete filledFormInstance.dataValues.form;
        delete filledFormInstance.dataValues.processInstance;
        delete filledFormInstance.dataValues.user;

        return res.status(200).json(resBuilder.success(filledFormInstance));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all filled forms instances"));
    }
});

/* GET form status by id */
router.get('/:id', async function (req, res, next) {
    try {
        const {eager} = routesUtils.getDefaultRequestParams(req);

        const formInstanceId = req.params.id;
        const form = await postgres.Forms.entity({id: formInstanceId}, eager);

        if (!form) {
            logger.error("Form not found");
            return res.status(400).json(resBuilder.fail("Bad request."));
        }

        return res.status(200).json(resBuilder.success(form));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting form status by id"));
    }
});

/* GET users emails by form instance id */
router.get('/users/:id', async function (req, res, next) {
    try {
        const formInstanceId = req.params.id;

        const formInstance = await postgres.FormsInstances.entity({formInstanceId: formInstanceId});

        if (!formInstance) {
            logger.error("Form instance not found");
            return res.status(400).json(resBuilder.fail("Bad request."));
        }

        const userIds = formInstance.dataValues.assigneeId;

        const usersEmails = [];
        for(let userId of userIds) {
            const user = await postgres.Users.entity({id: userId});
            if (user) {
                usersEmails.push(user.dataValues.email);
            }
        }

        return res.status(200).json(resBuilder.success({ emails: usersEmails.join(',') }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting form status by id"));
    }
});

/* POST create new form status or update form status*/
router.post('/', async function (req, res, next) {
    try {
        const {formData, formId, userId, processInstanceId} = req.body;

        if (!formData || formData.length === 0 || !formId || !userId) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const formSubmittedByUser = await postgres.Users.entity({id: userId});

        const form = await postgres.Forms.entity({id: formId}, true);
        const isFormStartingFormExists = await postgres.FormsDependencies.entities({formId: form.dataValues.formId});

        let isFormStartingForm = false;
        if (!isFormStartingFormExists || isFormStartingFormExists.length === 0) {
            isFormStartingForm = true;
        }

        const formInstanceId = form.dataValues.formId;

        if (isFormStartingForm && !processInstanceId) {
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
                processInstanceId: processStatus.dataValues.id,
                instanceAssigneeType: form.formAssigneeType,
                assigneeId: [parseInt(userId)]
            }
            const formInstance = await postgres.FormsInstances.create(formInstanceData);

            await createFollowUpFormsInstances(form, formInstanceId, processStatus.dataValues.id, formSubmittedByUser, formData);

            return res.status(200).json(resBuilder.success(formInstance));
        } else if (!isFormStartingForm && processInstanceId) {
            let formInstances = await postgres.FormsInstances.entities({
                formInstanceId: formInstanceId,
                formId: formId,
                processInstanceId: processInstanceId
            });
            const user = await postgres.Users.entity({id: userId});
            let isUserHasFormAccess = false;
            let formInstanceWithUserAccess;
            for (let formInstance of formInstances) {
                switch (formInstance.instanceAssigneeType) {
                    case "group":
                        if (user.dataValues.userGroupId === formInstance.dataValues.assigneeId[0]) {
                            formInstanceWithUserAccess = formInstance;
                            isUserHasFormAccess = true;
                        }
                        break;
                    case "individual_emails":
                        if (user.dataValues.id === formInstance.dataValues.assigneeId[0]) {
                            formInstanceWithUserAccess = formInstance;
                            isUserHasFormAccess = true;
                        }
                        break;
                    case "shared_emails":
                        if (formInstance.dataValues.assigneeId.includes(user.dataValues.id)) {
                            formInstanceWithUserAccess = formInstance;
                            isUserHasFormAccess = true;
                        }
                        break;
                    case "role":
                        if (user.dataValues.id === formInstance.dataValues.assigneeId[0]) {
                            formInstanceWithUserAccess = formInstance;
                            isUserHasFormAccess = true;
                        }
                        break;
                }

                if (isUserHasFormAccess) {
                    break;
                }
            }

            if (!isUserHasFormAccess || !formInstanceWithUserAccess) {
                logger.info("User doesn't have access to submitting this form");
                return res.status(400).json(resBuilder.fail("User doesn't have access to submitting this form"));
            }

            if (formInstanceWithUserAccess.dataValues.status !== formStatuses.WAITING) {
                logger.info("Form is not in waiting state, cannot be filled");
                return res.status(400).json(resBuilder.fail("Form is not in waiting state, cannot be filled"));
            }

            formInstanceWithUserAccess.formData = formData;
            formInstanceWithUserAccess.filledUserId = userId;
            formInstanceWithUserAccess.status = formStatuses.FILLED;

            await formInstanceWithUserAccess.save();

            const nextForms = await postgres.FormsDependencies.entities({prevFormId: formInstanceWithUserAccess.dataValues.formInstanceId});
            const nextFormsIds = [];

            for (let nextForm of nextForms) {
                nextFormsIds.push(nextForm.formId);
            }

            const nextWaitingFormsIds = [];
            for (let nextFormId of nextFormsIds) {
                let isPrevFormsFilled = true;
                const prevForms = await postgres.FormsDependencies.entities({formId: nextFormId});

                for (let prevForm of prevForms) {
                    const prevFormInstance = await postgres.FormsInstances.entities({
                        formInstanceId: prevForm.dataValues.prevFormId,
                        processInstanceId: processInstanceId
                    });

                    if (prevFormInstance.filter(f => f.dataValues.status !== formStatuses.FILLED).length !== 0) {
                        isPrevFormsFilled = false;
                        break;
                    }
                }

                if (isPrevFormsFilled) {
                    const nextForm = await postgres.FormsInstances.entity({
                        formInstanceId: nextFormId,
                        processInstanceId: processInstanceId
                    });

                    nextForm.status = formStatuses.WAITING;
                    nextWaitingFormsIds.push({
                        "formProcessId": nextForm.dataValues.id,
                        "formInstanceId": nextForm.dataValues.formInstanceId,
                    });
                    await nextForm.save();
                }
            }

            try {
                const storedUrl = formInstanceWithUserAccess.webhookUrl;
                let isValidUrl = false;
                try { new URL(storedUrl); isValidUrl = true; } catch {}

                const n8nAuth = { auth: { username: process.env.N8N_AUTH_USER, password: process.env.N8N_AUTH_PASSWORD } };

                if (isValidUrl) {
                    await axios.post(
                        storedUrl.replace('localhost', process.env.N8N_CONTAINER_NAME),
                        {
                            "isFirstNode": false,
                            "nextNodesIds": nextWaitingFormsIds,
                            "formData": formData,
                            "formName": form.dataValues.formName,
                            "formSubmittedByUser": formSubmittedByUser
                        },
                        n8nAuth
                    );
                } else {
                    logger.warn(`webhookUrl is invalid ("${storedUrl}") for formInstanceId=${formInstanceWithUserAccess.dataValues.formInstanceId}. Using start-webhook fallback.`);
                    const fallbackUrl = `${process.env.N8N_BASE_URL}webhook/${formInstanceWithUserAccess.dataValues.formInstanceId}/start`;
                    const payload = {
                        "isFirstNode": true,
                        "nextNodesIds": nextWaitingFormsIds,
                        "formData": formData,
                        "formName": form.dataValues.formName,
                        "formSubmittedByUser": formSubmittedByUser,
                    };
                    if (nextWaitingFormsIds.length > 0) {
                        const nf = await postgres.Forms.entity({ formId: nextWaitingFormsIds[0].formInstanceId });
                        if (nf) {
                            payload.nextFormData = nf.dataValues.formData;
                            payload.nextFormName = nf.dataValues.formName;
                        }
                    }
                    await axios.post(fallbackUrl, payload, n8nAuth);
                }
            } catch (e) {
                logger.error(`Failed to notify n8n after form submission: ${e.message}`);
            }

            await isProcessFinished(processInstanceId);

            return res.status(200).json(resBuilder.success(formInstanceWithUserAccess));
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

        if (!resumeUrl || !formInstanceId || !formProcessId) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const formInstance = await postgres.FormsInstances.entity({id: formProcessId, formInstanceId: formInstanceId});

        if (!formInstance) {
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

async function createFollowUpFormsInstances(form, formInstanceId, processStatusId, user, formData) {
    const processId = form.dataValues.processId;

    const processForms = await postgres.Forms.entities({processId: processId}, true);

    const nextForms = await postgres.FormsDependencies.entities({prevFormId: formInstanceId});

    const nextFormIds = [];

    for (let nextForm of nextForms) {
        nextFormIds.push(nextForm.dataValues.formId);
    }

    const nextNodesIds = [];
    for (let processForm of processForms) {
        if (processForm.dataValues.id === form.dataValues.id) {
            continue;
        }

        let formStatus = formStatuses.INACTIVE;

        let webhookUrl = "temp";
        if (nextFormIds.includes(processForm.dataValues.formId)) {
            formStatus = formStatuses.WAITING;
        }

        if (processForm.formAssigneeType === "role") {
            const roleAssignee = processForm.FormsAssignees.find(fa => fa.roleName);
            const resolvedUserIds = roleAssignee
                ? await resolveRoleToUsers(roleAssignee.roleName, user.dataValues.id)
                : [];

            for (const resolvedUserId of resolvedUserIds) {
                const newFormInstanceData = {
                    formData: {},
                    formInstanceId: processForm.dataValues.formId,
                    status: formStatus,
                    formId: processForm.id,
                    webhookUrl: webhookUrl,
                    processInstanceId: processStatusId,
                    instanceAssigneeType: "role",
                    assigneeId: [resolvedUserId],
                };
                const newFormInstance = await postgres.FormsInstances.create(newFormInstanceData);
                if (newFormInstance.dataValues.status === formStatuses.WAITING) {
                    nextNodesIds.push({
                        "formProcessId": newFormInstance.dataValues.id,
                        "formInstanceId": newFormInstance.dataValues.formInstanceId,
                    });
                }
            }
        } else {
            for (let formAssignee of processForm.FormsAssignees) {
                let formAssigneeId;
                let isBreakAfterOneExec = false;

                switch (processForm.formAssigneeType) {
                    case "group":
                        formAssigneeId = [formAssignee.userGroupId];
                        break;
                    case "shared_emails":
                        formAssigneeId = processForm.FormsAssignees.map(f => f.userId);
                        isBreakAfterOneExec = true;
                        break;
                    case "individual_emails":
                        formAssigneeId = [formAssignee.userId];
                        break;
                }

                const newFormInstanceData = {
                    formData: {},
                    formInstanceId: processForm.dataValues.formId,
                    status: formStatus,
                    formId: processForm.id,
                    webhookUrl: webhookUrl,
                    processInstanceId: processStatusId,
                    instanceAssigneeType: processForm.formAssigneeType,
                    assigneeId: formAssigneeId,
                }

                const newFormInstance = await postgres.FormsInstances.create(newFormInstanceData);
                if (newFormInstance.dataValues.status === formStatuses.WAITING) {
                    nextNodesIds.push({
                        "formProcessId": newFormInstance.dataValues.id,
                        "formInstanceId": newFormInstance.dataValues.formInstanceId
                    });
                }
                if (isBreakAfterOneExec) {
                    break;
                }
            }
        }
    }
    const formToStart = await postgres.Forms.entity({formId: formInstanceId});
    const n8nWebhookUrl = `${process.env.N8N_BASE_URL}webhook/${formInstanceId}/start`;
    await axios.post(
        n8nWebhookUrl,
        {
            "isFirstNode": true,
            "nextNodesIds": nextNodesIds,
            "formData": formData,
            "formName": form.dataValues.formName,
            "nextFormData": formToStart.dataValues.formData,
            "nextFormName": formToStart.dataValues.formName,
            "formSubmittedByUser": user
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
    const forms = await postgres.FormsInstances.entities({processInstanceId: processInstanceId});
    const isAnyFormsNotFilled = forms.filter(formInstance => formInstance.status !== formStatuses.FILLED);
    if (isAnyFormsNotFilled.length === 0) {
        const processInstance = await postgres.ProcessesInstances.entity({id: processInstanceId});
        processInstance.status = processInstances.ENDED;
        await processInstance.save();
    }
}


async function resolveRoleToUsers(roleName, initiatorUserId) {
    const { Op } = require('sequelize');
    const anyPatternRole = await postgres.OrgRoles.findOne({
        where: { name: roleName, emailPattern: { [Op.not]: null } },
    });

    if (anyPatternRole) {
        const allRoles = await postgres.OrgRoles.findAll({ where: { name: roleName } });
        const resolvedUserIds = new Set();
        for (const role of allRoles) {
            const userOrgRoles = await postgres.UserOrgRoles.entities({ orgRoleId: role.id });
            userOrgRoles.forEach(uor => resolvedUserIds.add(uor.userId));
        }
        return [...resolvedUserIds];
    }

    const initiator = await postgres.Users.entity({ id: initiatorUserId });
    if (!initiator) return [];

    const startUnitIds = new Set();
    if (initiator.orgUnitId) startUnitIds.add(initiator.orgUnitId);

    const workplaces = await postgres.UserWorkplaces.entities({ userId: initiatorUserId });
    workplaces.forEach(wp => startUnitIds.add(wp.orgUnitId));

    if (startUnitIds.size === 0) return [];

    const resolvedUserIds = new Set();
    for (const startUnitId of [...startUnitIds]) {
        let currentUnitId = startUnitId;
        while (currentUnitId != null) {
            const orgRole = await postgres.OrgRoles.entity({ orgUnitId: currentUnitId, name: roleName });
            if (orgRole) {
                const userOrgRoles = await postgres.UserOrgRoles.entities({ orgRoleId: orgRole.id });
                if (userOrgRoles.length > 0) {
                    userOrgRoles.forEach(uor => resolvedUserIds.add(uor.userId));
                    break;
                }
            }
            const unit = await postgres.OrgUnits.entity({ id: currentUnitId });
            currentUnitId = unit ? unit.parentId : null;
        }
    }
    return [...resolvedUserIds];
}

async function getAllPrevFormIds(startFormId) {
    const visited = new Set();
    const result = [];

    async function traverse(formId) {
        if (visited.has(formId)) return;
        visited.add(formId);

        const dependencies = await postgres.FormsDependencies.entities({ formId });
        for (const dep of dependencies) {
            if (dep.prevFormId) {
                result.push(dep.prevFormId);
                await traverse(dep.prevFormId);
            }
        }
    }

    await traverse(startFormId);
    return result;
}

module.exports = router;