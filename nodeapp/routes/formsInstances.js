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

// returns WAITING form instances that belong to the current user;
// after filtering, enriches each instance with the process/form name and the name of the person
// who originally started the process (so the approver can see whose request they're reviewing)
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

        // group-assigned instances match on group ID; all others match on user ID
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

        const filteredInstances = previousFormsInstances.filter(f => f.dataValues.instanceAssigneeType !== 'action');

        filteredInstances.map(f => {
            f.dataValues.formName = f.dataValues.form.formName;
            delete f.dataValues.form;
            delete f.dataValues.processInstance;
            delete f.dataValues.user;
        });

        return res.status(200).json(resBuilder.success(filteredInstances));
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

// handles form submission for both the starting form (no processInstanceId) and follow-up steps:
//   - starting form: creates a ProcessInstance + FormInstance, spins up all subsequent instances
//   - follow-up form: validates the user has access, marks the instance FILLED, activates the next steps
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

            const nextWaitingFormsIds = await routeAfterFormFilled(
                formInstanceWithUserAccess.dataValues.formInstanceId,
                processInstanceId,
                form.dataValues.processId,
                formData
            );

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

// stores the n8n resume URL sent by FormInstanceResumeNode so the frontend
// can later POST to it when the user submits their form
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

// called by the action workflow's final node after it finishes (e.g. after sending an email);
// marks the action form instance as FILLED and triggers whatever comes next in the process
router.post('/actionComplete', async function (req, res) {
    try {
        const { formProcessId } = req.body;

        if (!formProcessId) {
            return res.status(400).json(resBuilder.fail('Bad request'));
        }

        const formInstance = await postgres.FormsInstances.findByPk(formProcessId);

        if (!formInstance) {
            return res.status(400).json(resBuilder.fail('Form instance not found'));
        }

        if (formInstance.status !== formStatuses.WAITING) {
            return res.status(400).json(resBuilder.fail('Form instance is not in waiting state'));
        }

        formInstance.status = formStatuses.FILLED;
        formInstance.formData = {};
        await formInstance.save();

        const processInstanceId = formInstance.processInstanceId;
        const form = await postgres.Forms.entity({ id: formInstance.formId });

        const nextWaitingFormsIds = await routeAfterFormFilled(
            formInstance.formInstanceId,
            processInstanceId,
            form.dataValues.processId,
            {}
        );

        for (const nextNode of nextWaitingFormsIds) {
            try {
                await axios.post(
                    `${process.env.N8N_BASE_URL}webhook/${nextNode.formInstanceId}/start`,
                    {
                        isFirstNode: false,
                        nextNodesIds: [{ formProcessId: nextNode.formProcessId, formInstanceId: nextNode.formInstanceId }],
                        formData: {},
                        formSubmittedByUser: null,
                        formName: '',
                        nextFormData: [],
                        nextFormName: '',
                    },
                    {
                        auth: {
                            username: process.env.N8N_AUTH_USER,
                            password: process.env.N8N_AUTH_PASSWORD,
                        },
                    }
                );
            } catch (e) {
                logger.warn(`Failed to trigger n8n for form instance ${nextNode.formInstanceId}: ${e.message}`);
            }
        }

        await isProcessFinished(processInstanceId);

        return res.status(200).json(resBuilder.success({ ok: true }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error('Something went wrong while completing action'));
    }
});

// called immediately after the first (starting) form is submitted;
// creates INACTIVE/WAITING form instances for every subsequent step,
// evaluates conditions to decide which branches to skip,
// then fires the n8n start webhook so the first step's workflow can proceed
async function createFollowUpFormsInstances(form, formInstanceId, processStatusId, user, formData) {
    const processId = form.dataValues.processId;

    const processForms = await postgres.Forms.entities({processId: processId}, true);

    const nextForms = await postgres.FormsDependencies.entities({prevFormId: formInstanceId});
    const nextFormIds = nextForms.map(nf => nf.dataValues.formId);

    const nextNodesIds = [];
    const blockedFormIds = [];

    for (let processForm of processForms) {
        if (processForm.dataValues.id === form.dataValues.id) {
            continue;
        }

        let formStatus = formStatuses.INACTIVE;

        if (nextFormIds.includes(processForm.dataValues.formId)) {
            const condResult = await evaluateConditions(
                formInstanceId,
                processForm.dataValues.formId,
                processId,
                formData
            );
            if (condResult !== 'blocked') {
                formStatus = formStatuses.WAITING;
            } else {
                blockedFormIds.push(processForm.dataValues.formId);
            }
        }

        if (processForm.formType === 'action') {
            const newFormInstance = await postgres.FormsInstances.create({
                formData: {},
                formInstanceId: processForm.dataValues.formId,
                status: formStatus,
                formId: processForm.id,
                webhookUrl: 'temp',
                processInstanceId: processStatusId,
                instanceAssigneeType: 'action',
                assigneeId: [],
            });
            if (newFormInstance.dataValues.status === formStatuses.WAITING) {
                await triggerActionWorkflow(newFormInstance, formData);
            }
            continue;
        }

        if (processForm.formAssigneeType === "role") {
            const roleAssignee = processForm.FormsAssignees.find(fa => fa.roleName);
            const resolvedUserIds = roleAssignee
                ? await resolveRoleToUsers(roleAssignee.roleName, user.dataValues.id)
                : [];

            for (const resolvedUserId of resolvedUserIds) {
                const newFormInstance = await postgres.FormsInstances.create({
                    formData: {},
                    formInstanceId: processForm.dataValues.formId,
                    status: formStatus,
                    formId: processForm.id,
                    webhookUrl: 'temp',
                    processInstanceId: processStatusId,
                    instanceAssigneeType: "role",
                    assigneeId: [resolvedUserId],
                });
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

                const newFormInstance = await postgres.FormsInstances.create({
                    formData: {},
                    formInstanceId: processForm.dataValues.formId,
                    status: formStatus,
                    formId: processForm.id,
                    webhookUrl: 'temp',
                    processInstanceId: processStatusId,
                    instanceAssigneeType: processForm.formAssigneeType,
                    assigneeId: formAssigneeId,
                });

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

    for (const blockedFormId of blockedFormIds) {
        await skipFormAndDescendants(blockedFormId, processStatusId);
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

// marks the process instance as ENDED when every form instance is in a terminal state
async function isProcessFinished(processInstanceId) {
    const forms = await postgres.FormsInstances.entities({processInstanceId: processInstanceId});
    const isAnyFormsNotDone = forms.filter(fi =>
        fi.status !== formStatuses.FILLED && fi.status !== formStatuses.SKIPPED
    );
    if (isAnyFormsNotDone.length === 0) {
        const processInstance = await postgres.ProcessesInstances.entity({id: processInstanceId});
        processInstance.status = processInstances.ENDED;
        await processInstance.save();
    }
}

// called after any non-starting form is submitted;
// activates the next INACTIVE instances that are now unblocked,
// skips branches excluded by conditions,
// and returns a list of newly WAITING form instance IDs for n8n to pick up
async function routeAfterFormFilled(sourceFormId, processInstanceId, processId, formData) {
    const nextDeps = await postgres.FormsDependencies.entities({ prevFormId: sourceFormId });
    const nextWaitingFormsIds = [];
    const blockedFormIds = [];

    for (const dep of nextDeps) {
        const nextFormId = dep.formId;

        const condResult = await evaluateConditions(sourceFormId, nextFormId, processId, formData);

        if (condResult === 'blocked') {
            blockedFormIds.push(nextFormId);
            continue;
        }

        const prevDeps = await postgres.FormsDependencies.entities({ formId: nextFormId });
        let allPrevDone = true;

        for (const prevDep of prevDeps) {
            const prevInstances = await postgres.FormsInstances.entities({
                formInstanceId: prevDep.dataValues.prevFormId,
                processInstanceId,
            });

            const allDone = prevInstances.every(fi =>
                fi.status === formStatuses.FILLED || fi.status === formStatuses.SKIPPED
            );

            if (!allDone) {
                allPrevDone = false;
                break;
            }
        }

        if (!allPrevDone) continue;

        const nextFormRecord = await postgres.Forms.entity({ formId: nextFormId }, true);
        if (!nextFormRecord) continue;

        if (nextFormRecord.formType === 'action') {
            const nextFormInstance = await postgres.FormsInstances.entity({
                formInstanceId: nextFormId,
                processInstanceId,
            });
            if (nextFormInstance && nextFormInstance.status === formStatuses.INACTIVE) {
                nextFormInstance.status = formStatuses.WAITING;
                await nextFormInstance.save();
                await triggerActionWorkflow(nextFormInstance, formData);
            }
        } else {
            const nextFormInstances = await postgres.FormsInstances.entities({
                formInstanceId: nextFormId,
                processInstanceId,
            });

            if (nextFormInstances.length === 0 && nextFormRecord.formAssigneeType === 'role') {
                const roleAssignee = nextFormRecord.FormsAssignees?.find(fa => fa.roleName);
                if (roleAssignee) {
                    const processInstance = await postgres.ProcessesInstances.entity({ id: processInstanceId });
                    const initiatorUserId = processInstance?.initUserId;
                    if (initiatorUserId) {
                        const resolvedUserIds = await resolveRoleToUsers(roleAssignee.roleName, initiatorUserId);
                        for (const resolvedUserId of resolvedUserIds) {
                            const newInstance = await postgres.FormsInstances.create({
                                formData: {},
                                formInstanceId: nextFormId,
                                status: formStatuses.WAITING,
                                formId: nextFormRecord.id,
                                webhookUrl: 'temp',
                                processInstanceId,
                                instanceAssigneeType: 'role',
                                assigneeId: [resolvedUserId],
                            });
                            nextWaitingFormsIds.push({
                                formProcessId: newInstance.dataValues.id,
                                formInstanceId: newInstance.dataValues.formInstanceId,
                            });
                        }
                    }
                }
            } else {
                for (const nextFormInstance of nextFormInstances) {
                    if (nextFormInstance.status === formStatuses.INACTIVE) {
                        nextFormInstance.status = formStatuses.WAITING;
                        await nextFormInstance.save();
                        nextWaitingFormsIds.push({
                            formProcessId: nextFormInstance.dataValues.id,
                            formInstanceId: nextFormInstance.dataValues.formInstanceId,
                        });
                    }
                }
            }
        }
    }

    for (const blockedFormId of blockedFormIds) {
        await skipFormAndDescendants(blockedFormId, processInstanceId);
    }

    return nextWaitingFormsIds;
}

// decides whether the edge from sourceForm to targetForm is 'allowed', 'blocked', or 'unconditional':
//   - no conditions on sourceForm → unconditional (always proceed)
//   - condition exists for targetForm → evaluate it directly
//   - conditions exist but none targets this form → blocked if any other branch matched (exclusive branching)
async function evaluateConditions(sourceFormId, targetFormId, processId, formData) {
    const allConditions = await postgres.FormConditions.entities({ processId, sourceFormId });

    if (allConditions.length === 0) return 'unconditional';

    const conditionForTarget = allConditions.find(c => c.targetFormId === targetFormId);

    if (!conditionForTarget) {
        const anyConditionalMatched = allConditions.some(c => checkCondition(c, formData));
        return anyConditionalMatched ? 'blocked' : 'allowed';
    }

    return checkCondition(conditionForTarget, formData) ? 'allowed' : 'blocked';
}

function checkCondition(condition, formData) {
    if (!Array.isArray(formData)) return false;

    let fieldValue = undefined;
    for (const group of formData) {
        if (group[condition.fieldName] !== undefined) {
            fieldValue = group[condition.fieldName].value;
            break;
        }
    }

    if (fieldValue === undefined || fieldValue === null) return false;

    const strVal = String(fieldValue).toLowerCase().trim();
    const expected = String(condition.expectedValue).toLowerCase().trim();

    switch (condition.operator) {
        case 'equals':      return strVal === expected;
        case 'notEquals':   return strVal !== expected;
        case 'contains':    return strVal.includes(expected);
        case 'greaterThan': return Number(fieldValue) > Number(condition.expectedValue);
        case 'lessThan':    return Number(fieldValue) < Number(condition.expectedValue);
        default:            return false;
    }
}

// recursively marks a form instance and all downstream instances as SKIPPED;
// stops recursing into a branch if any predecessor of the next form is still in progress
async function skipFormAndDescendants(formInstanceId, processInstanceId) {
    const formInstances = await postgres.FormsInstances.entities({
        formInstanceId,
        processInstanceId,
    });

    let skippedAny = false;
    for (const fi of formInstances) {
        if (fi.status === formStatuses.INACTIVE) {
            fi.status = formStatuses.SKIPPED;
            await fi.save();
            skippedAny = true;
        }
    }

    if (!skippedAny) return;

    const nextDeps = await postgres.FormsDependencies.entities({ prevFormId: formInstanceId });

    for (const dep of nextDeps) {
        const nextFormId = dep.formId;

        const allPrevDeps = await postgres.FormsDependencies.entities({ formId: nextFormId });
        let allPrevDone = true;

        for (const prevDep of allPrevDeps) {
            const prevInstances = await postgres.FormsInstances.entities({
                formInstanceId: prevDep.dataValues.prevFormId,
                processInstanceId,
            });

            const allDone = prevInstances.every(fi =>
                fi.status === formStatuses.FILLED || fi.status === formStatuses.SKIPPED
            );

            if (!allDone) {
                allPrevDone = false;
                break;
            }
        }

        if (allPrevDone) {
            await skipFormAndDescendants(nextFormId, processInstanceId);
        }
    }
}

async function triggerActionWorkflow(formInstance, formData) {
    try {
        const url = `${process.env.N8N_BASE_URL}webhook/${formInstance.formInstanceId}/start`;
        await axios.post(
            url,
            {
                isFirstNode: false,
                nextNodesIds: [{
                    formProcessId: formInstance.dataValues.id,
                    formInstanceId: formInstance.dataValues.formInstanceId,
                }],
                formData: formData || {},
                formSubmittedByUser: null,
            },
            {
                auth: {
                    username: process.env.N8N_AUTH_USER,
                    password: process.env.N8N_AUTH_PASSWORD,
                }
            }
        );
    } catch (e) {
        logger.error(`Failed to trigger action workflow for ${formInstance.formInstanceId}: ${e.message}`);
    }
}


// finds the user IDs who currently hold a given role in the context of a specific process initiator.
//
// Two resolution strategies:
//   1. If the role has an emailPattern set on any instance, collect all users assigned to any
//      role with that name regardless of unit (global pattern-based roles).
//   2. Otherwise walk up the org hierarchy from the initiator's org unit (and workplaces)
//      until a unit is found that has the named role with at least one current assignee.
//      This lets e.g. a student from Faculty A automatically get the Faculty A dean.
async function resolveRoleToUsers(roleName, initiatorUserId) {
    const { Op } = require('sequelize');

    const currentSemester = await postgres.Semesters.findOne({ where: { isCurrent: true } });
    const now = new Date();
    const temporalWhere = currentSemester
        ? {
            [Op.or]: [
                { semesterId: currentSemester.id },
                {
                    semesterId: null,
                    [Op.and]: [
                        { [Op.or]: [{ validFrom: null }, { validFrom: { [Op.lte]: now } }] },
                        { [Op.or]: [{ validTo: null }, { validTo: { [Op.gte]: now } }] },
                    ],
                },
            ],
        }
        : {
            [Op.and]: [
                { [Op.or]: [{ validFrom: null }, { validFrom: { [Op.lte]: now } }] },
                { [Op.or]: [{ validTo: null }, { validTo: { [Op.gte]: now } }] },
            ],
        };

    const anyPatternRole = await postgres.OrgRoles.findOne({
        where: { name: roleName, emailPattern: { [Op.not]: null } },
    });
    if (anyPatternRole) {
        const allRoles = await postgres.OrgRoles.findAll({ where: { name: roleName } });
        const resolvedUserIds = new Set();
        for (const role of allRoles) {
            const userOrgRoles = await postgres.UserOrgRoles.findAll({
                where: { orgRoleId: role.id, ...temporalWhere },
            });
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

    const studentRoleAssignments = await postgres.UserOrgRoles.findAll({
        where: { userId: initiatorUserId, ...temporalWhere },
        include: [{
            model: postgres.OrgRoles,
            as: 'OrgRole',
            where: { isStudentRole: true },
            required: true,
        }],
    });
    for (const sra of studentRoleAssignments) {
        if (sra.OrgRole?.orgUnitId) startUnitIds.add(sra.OrgRole.orgUnitId);
    }

    if (startUnitIds.size === 0) return [];

    const resolvedUserIds = new Set();
    for (const startUnitId of [...startUnitIds]) {
        let currentUnitId = startUnitId;
        while (currentUnitId != null) {
            const orgRole = await postgres.OrgRoles.entity({ orgUnitId: currentUnitId, name: roleName });
            if (orgRole) {
                const userOrgRoles = await postgres.UserOrgRoles.findAll({
                    where: { orgRoleId: orgRole.id, ...temporalWhere },
                });
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

/* POST re-resolve role-based form instances for a process instance where resolution returned 0 users */
router.post('/re-resolve/:processInstanceId', async function (req, res) {
    try {
        const result = await reResolveProcessInstance(req.params.processInstanceId);
        if (result.error) return res.status(400).json(resBuilder.fail(result.error));
        return res.status(200).json(resBuilder.success(result));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while re-resolving form instances"));
    }
});

async function reResolveProcessInstance(processInstanceId) {
    const processInstance = await postgres.ProcessesInstances.entity({ id: processInstanceId });
    if (!processInstance) return { error: "Process instance not found" };

    const processForms = await postgres.Forms.entities({ processId: processInstance.processId }, true);
    const startingForm = processForms.find(f => f.isStartingNode);
    if (!startingForm) return { error: "Starting form not found" };

    const startingInstance = await postgres.FormsInstances.entity({
        formId: startingForm.id,
        processInstanceId,
    });
    if (!startingInstance) return { error: "Starting form instance not found" };

    const initiatorUserId = startingInstance.filledUserId;
    if (!initiatorUserId) return { error: "Initiator user not found" };

    const allInstances = await postgres.FormsInstances.entities({ processInstanceId });
    const filledFormInstanceIds = new Set(
        allInstances
            .filter(fi => fi.status === formStatuses.FILLED)
            .map(fi => fi.formInstanceId)
    );

    let created = 0;
    const nextNodesIds = [];

    for (const processForm of processForms) {
        if (processForm.formAssigneeType !== 'role') continue;

        const existingInstances = allInstances.filter(
            fi => fi.formId === processForm.id && fi.instanceAssigneeType === 'role'
        );
        if (existingInstances.length > 0) continue;

        const roleAssignee = processForm.FormsAssignees.find(fa => fa.roleName);
        if (!roleAssignee) continue;

        const resolvedUserIds = await resolveRoleToUsers(roleAssignee.roleName, initiatorUserId);
        if (resolvedUserIds.length === 0) continue;

        const deps = await postgres.FormsDependencies.entities({ formId: processForm.dataValues.formId });
        const hasFulfilledDep = deps.some(dep => filledFormInstanceIds.has(dep.prevFormId));
        const formStatus = hasFulfilledDep ? formStatuses.WAITING : formStatuses.INACTIVE;

        for (const resolvedUserId of resolvedUserIds) {
            const newFormInstance = await postgres.FormsInstances.create({
                formData: {},
                formInstanceId: processForm.dataValues.formId,
                status: formStatus,
                formId: processForm.id,
                webhookUrl: 'temp',
                processInstanceId,
                instanceAssigneeType: 'role',
                assigneeId: [resolvedUserId],
            });
            created++;
            if (formStatus === formStatuses.WAITING) {
                nextNodesIds.push({
                    formProcessId: newFormInstance.dataValues.id,
                    formInstanceId: newFormInstance.dataValues.formInstanceId,
                });
            }
        }
    }

    return { created, nextNodesIds };
}

async function findStuckProcessInstancesForRole(roleName) {
    const { Op } = require('sequelize');

    const formsAssignees = await postgres.FormsAssignees.findAll({ where: { roleName } });
    const formIds = [...new Set(formsAssignees.map(fa => fa.formId))];
    if (formIds.length === 0) return [];

    const existingInstances = await postgres.FormsInstances.findAll({
        where: { formId: formIds, instanceAssigneeType: 'role' },
        attributes: ['formId', 'processInstanceId'],
    });
    const coveredPairs = new Set(existingInstances.map(fi => `${fi.formId}:${fi.processInstanceId}`));

    const activeProcessInstances = await postgres.ProcessesInstances.findAll({
        where: { status: { [Op.ne]: 'ended' } },
        limit: 500,
    });

    const stuckIds = new Set();
    for (const pi of activeProcessInstances) {
        for (const formId of formIds) {
            if (!coveredPairs.has(`${formId}:${pi.id}`)) {
                stuckIds.add(pi.id);
                break;
            }
        }
    }
    return [...stuckIds];
}

router.reResolveProcessInstance = reResolveProcessInstance;
router.findStuckProcessInstancesForRole = findStuckProcessInstancesForRole;

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