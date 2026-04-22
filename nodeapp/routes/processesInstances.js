/* global logger */
/* global resBuilder */

let express = require('express');
const routesUtils = require("../utils/RoutesUtils");
const formStatuses = require('../enums/FormStatuses');
const {Op} = require("sequelize");
let router = express.Router();

// returns all process instances started by the current user, plus any form instances
// where this user filled a non-starting form (e.g. a professor who approved a request).
// the two groups are returned separately so the frontend can render them differently.
router.get('/initialized', async function (req, res) {
    try {
        const { eager, length, offset } = routesUtils.getDefaultRequestParams(req);

        let initializedProcessesInstances = await postgres.ProcessesInstances.entities({initUserId: req.userId});

        for(let initializedProcessInstance of initializedProcessesInstances) {
            const process = await postgres.Processes.entity({id: initializedProcessInstance.dataValues.processId});
            initializedProcessInstance.dataValues.name = process.dataValues.name;
            const formsInstances = await postgres.FormsInstances.entities({ processInstanceId: initializedProcessInstance.dataValues.id });
            for(let formsInstance of formsInstances) {
                // hide form data for steps that haven't been filled yet
                if(formsInstance.dataValues.status !== formStatuses.FILLED) {
                    formsInstance.dataValues.formData = {};
                    const form = await postgres.Forms.entity({id: formsInstance.dataValues.formId});
                    formsInstance.dataValues.formName = form.formName;
                }
            }
            initializedProcessInstance.dataValues['formsInstances'] = formsInstances;
        }

        const initializedProcessInstancesIds = initializedProcessesInstances.map(f => f.dataValues.id);

        // also include form instances filled by this user in processes they didn't start
        const restFormsInstances = await postgres.FormsInstances.entities({filledUserId: req.userId, processInstanceId: { [Op.notIn]: initializedProcessInstancesIds }});

        for(let restFormInstance of restFormsInstances) {
            const form = await postgres.Forms.entity({id: restFormInstance.dataValues.formId});

            // find the name of the person who originally started the process
            if(form.dataValues.isStartingNode === true) {
                const startingFormInstance = await postgres.FormsInstances.entity({formId: form.dataValues.id, processInstanceId: restFormInstance.dataValues.processInstanceId}, true);
                restFormInstance.dataValues.initialUserName = startingFormInstance.dataValues.user.name;
            } else {
                const startingFormNode = await postgres.Forms.entity({processId: form.dataValues.processId, isStartingNode: true});
                const startingFormInstance = await postgres.FormsInstances.entity({formId: startingFormNode.dataValues.id, processInstanceId: restFormInstance.dataValues.processInstanceId}, true);
                restFormInstance.dataValues.initialUserName = startingFormInstance.dataValues.user.name;
            }
            restFormInstance.dataValues.formName = form.dataValues.formName;
        }

        return res.status(200).json(resBuilder.success({processesInstances: initializedProcessesInstances, formsInstances: restFormsInstances}));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all filled forms instances"));
    }
});

/* GET single process instance with all its form instances */
router.get('/initialized/:id', async function (req, res) {
    try {
        const { eager, length, offset } = routesUtils.getDefaultRequestParams(req);
        const id = req.params.id;

        let initializedProcessInstance = await postgres.ProcessesInstances.entity({id: id, initUserId: req.userId});

        const process = await postgres.Processes.entity({id: initializedProcessInstance.dataValues.processId});
        initializedProcessInstance.dataValues.name = process.dataValues.name;
        const formsInstances = await postgres.FormsInstances.entities({ processInstanceId: initializedProcessInstance.dataValues.id });
        for(let formsInstance of formsInstances) {
            // hide data for steps that are still pending
            if(formsInstance.dataValues.status !== formStatuses.FILLED) {
                formsInstance.dataValues.formData = {};
            }
        }
        initializedProcessInstance.dataValues['formsInstances'] = formsInstances;

        return res.status(200).json(resBuilder.success({initializedProcessInstance}));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all filled forms instances"));
    }
});

module.exports = router;
