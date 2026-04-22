/* global logger */
/* global resBuilder */

let express = require('express');
const routesUtils = require("../utils/RoutesUtils");
const {Op} = require("sequelize");
const processStatus = require('../enums/ProcessesStatuses');
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

// returns only the starting-node forms the current user is allowed to initiate;
// a form is visible if the user matches at least one FormsAssignee entry by group, direct userId, or role
router.get('/available', async function (req, res, next) {
    try {
        const {eager, length, offset} = routesUtils.getDefaultRequestParams(req);

        const currentUser = await postgres.Users.entity({ id: req.userId });
        const userGroupId = currentUser ? parseInt(currentUser.userGroupId) : null;

        // collect all org role names the user currently holds for role-based matching
        const userOrgRoleAssignments = await postgres.UserOrgRoles.entities({ userId: req.userId }, true);
        const userRoleNames = new Set(
            userOrgRoleAssignments.map(uor => uor.OrgRole?.name).filter(Boolean)
        );

        let forms = await postgres.Forms.entities({isStartingNode: true}, true, null, length, offset);
        forms = forms.filter(form => {
            const process = form.dataValues.Processes;
            // only show forms whose parent process is in PUBLISHED state
            if (!process || process.status !== processStatus.PUBLISHED) return false;
            return form.dataValues.FormsAssignees.some(fa => {
                if (fa.userGroupId !== null && userGroupId !== null && fa.userGroupId === userGroupId) return true;
                if (fa.userId !== null && fa.userId === req.userId) return true;
                return !!(fa.roleName && userRoleNames.has(fa.roleName));
            });
        });

        return res.status(200).json(resBuilder.success(forms));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all available forms"));
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

// called by the DynamicForm / ProcessActionNode n8n nodes during the process setup run;
// creates or updates a Form record and its assignee configuration
router.post('/', async function (req, res, next) {
    try {
        const {formName, formId, formData, processId, prevFormIds, userConfig} = req.body;

        const isActionForm = userConfig?.type === 'action';
        if(!formName || !formId || !formData || (!isActionForm && formData.length === 0) || !processId || !userConfig ) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        let userGroup;
        let formAssigneeType = "group";
        let users;
        let userEmails;
        let roleName;
        let formType = "form";
        let actionWorkflowNodes = null;

        // translate the userConfig sent from n8n into the DB fields
        switch (userConfig.type) {
            case "group":
                userGroup = await postgres.UsersGroups.entity({name: userConfig.data.groupName});
                if(!userGroup) {
                    userGroup = await postgres.UsersGroups.create({name: userConfig.data.groupName});
                }
                break;
            case "emails":
                switch (userConfig.data.mode) {
                    case "shared":
                        // all listed emails share a single form instance
                        formAssigneeType = "shared_emails";
                        users = userConfig.data.emails;
                        userEmails = userConfig.data.emails.join(',');
                        break;
                    case "individual":
                        // each email gets their own form instance
                        formAssigneeType = "individual_emails";
                        users = userConfig.data.users;
                        userEmails = userConfig.data.users.map(u => u.email).join(',');
                        break;
                    default:
                        break;
                }
                break;
            case "role":
                formAssigneeType = "role";
                roleName = userConfig.data.roleName;
                break;
            case "action":
                formAssigneeType = "action";
                formType = "action";
                actionWorkflowNodes = userConfig.data.actionWorkflowNodes || null;
                break;
            default:
                break;
        }

        if(prevFormIds) {
            const existingPrevFormDependencies = await postgres.FormsDependencies.entities({processId: processId, formId: formId});

            // remove dependency records for predecessors that are no longer connected
            for(let existingPrevFormDependency of existingPrevFormDependencies) {
                if(!prevFormIds.includes(existingPrevFormDependency.dataValues.prevFormId)) {
                    await existingPrevFormDependency.destroy();
                }
            }

            for(let prevFormId of prevFormIds.split(',')) {
                const prevForm = await postgres.Forms.entity({formId: prevFormId});

                if(!prevForm) {
                    // n8n nodes can register in any order; create a placeholder so the FK constraint holds
                    const prevFormData = {
                        formName: "TempName",
                        formId: prevFormId,
                        formData: {"tempData": "tempData"},
                        processId: processId,
                        formAssigneeType: "temp",
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

        const process = await postgres.Processes.entity({id: processId});

        if(!process) {
            logger.error("Process not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        if(ifFormExists) {
            ifFormExists.formName = formName;
            ifFormExists.formData = formData;
            ifFormExists.isStartingNode = !prevFormIds;
            ifFormExists.formAssigneeType = formAssigneeType;
            ifFormExists.formType = formType;
            if (actionWorkflowNodes !== null) ifFormExists.actionWorkflowNodes = actionWorkflowNodes;

            if (formType !== 'action') {
                userEmails ? await createUsersDependencies(userEmails, ifFormExists.dataValues.id) : null;
                await createFormsAssignees(ifFormExists.dataValues.id, users, userGroup?.id, roleName);
            }

            await ifFormExists.save();

            return res.status(200).json(resBuilder.success(ifFormExists));
        } else {
            const newFormData = {
                formName: formName,
                formId: formId,
                formData: formData,
                processId: processId,
                isStartingNode: !prevFormIds,
                formAssigneeType: formAssigneeType,
                formType: formType,
                actionWorkflowNodes: actionWorkflowNodes,
            }

            const form = await postgres.Forms.create(newFormData);

            if (formType !== 'action') {
                userEmails ? await createUsersDependencies(userEmails, form.dataValues.id) : null;
                await createFormsAssignees(form.dataValues.id, users, userGroup?.id, roleName);
            }

            if(form) {
                return res.status(200).json(resBuilder.success(form));
            }

            throw new Error("Form is not created");
        }
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while creating a new form"));
    }
});

/* PUT update form */
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

// ensures a UsersFormsDependencies record exists for every email;
// creates a stub user if the email hasn't logged in yet
async function createUsersDependencies(userEmails, formId) {
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
            user = await postgres.Users.create({ email });
        }
        userIds.push(user.dataValues.id);
    }

    const existingDeps = await postgres.UsersFormsDependencies.entities({ formId });

    // remove deps for emails that were removed from the list
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

// syncs FormsAssignees to match the current userConfig;
// role-based assignment is a single record; group/email assignment is one record per user
async function createFormsAssignees(formId, users = null, userGroupId = null, roleName = null) {
    if (roleName) {
        // role assignment: replace whatever was there with a single role record
        const existing = await postgres.FormsAssignees.entities({ formId });
        for (const dep of existing) {
            await dep.destroy();
        }
        await postgres.FormsAssignees.create({ formId, roleName, userId: null, userGroupId: null });
        return;
    }

    const resultObjects = [];
    if(users && users.length > 0) {
        for(let user of users) {
            let userId;
            let note;
            if(user.email) {
                userId = await getUserIdOrCreateUser(user.email);
                note = user.note;
            } else {
                userId = await getUserIdOrCreateUser(user);
            }
            resultObjects.push({
                formId,
                userGroupId,
                userId: userId,
                accompanyingText: note ? note : null,
            })
        }
    } else {
        resultObjects.push({
            formId,
            userGroupId,
            userId: null,
            accompanyingText: null,
        })
    }

    const existingAssignees = await postgres.FormsAssignees.entities({
        formId: formId,
        userGroupId: userGroupId
    });

    const newAssigneesKeys = new Set(
        resultObjects.map(obj => `${obj.userId || 'NULL'}-${obj.userGroupId || 'NULL'}`)
    );

    for(let existingAssignee of existingAssignees) {
        const existingKey = `${existingAssignee.userId || 'NULL'}-${existingAssignee.userGroupId || 'NULL'}`;

        if(!newAssigneesKeys.has(existingKey)) {
            await existingAssignee.destroy();
            logger.info(`Deleted FormsAssignee: id=${existingAssignee.id}, formId=${formId}, userId=${existingAssignee.userId}`);
        }
    }

    for(let resultObject of resultObjects) {
        const whereCondition = {
            formId: resultObject.formId,
        };

        if(resultObject.userGroupId !== null && resultObject.userGroupId !== undefined) {
            whereCondition.userGroupId = resultObject.userGroupId;
        } else {
            whereCondition.userGroupId = null;
        }

        if(resultObject.userId !== null && resultObject.userId !== undefined) {
            whereCondition.userId = resultObject.userId;
        } else {
            whereCondition.userId = null;
        }

        const ifFormsAssigneesExists = await postgres.FormsAssignees.entity(whereCondition);

        if(!ifFormsAssigneesExists) {
            await postgres.FormsAssignees.create(resultObject);
            logger.info(`Created FormsAssignee: formId=${formId}, userId=${resultObject.userId}, userGroupId=${resultObject.userGroupId}`);
        } else {
            let needsUpdate = false;

            if(ifFormsAssigneesExists.accompanyingText !== resultObject.accompanyingText) {
                ifFormsAssigneesExists.accompanyingText = resultObject.accompanyingText;
                needsUpdate = true;
            }

            if(needsUpdate) {
                await ifFormsAssigneesExists.save();
                logger.info(`Updated FormsAssignee: id=${ifFormsAssigneesExists.id}, formId=${formId}`);
            }
        }
    }
}

async function getUserIdOrCreateUser(email) {
    let userId = await postgres.Users.entity({email: email});
    if(!userId) {
        userId = await postgres.Users.create({ email: email });
    }
    return userId.dataValues.id;
}

module.exports = router;
