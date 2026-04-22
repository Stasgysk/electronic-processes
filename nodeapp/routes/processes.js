/* global logger */
/* global resBuilder */
/* global routesUtils */

let express = require('express');
let router = express.Router();
const routesUtils = require("../utils/RoutesUtils");
const processStatus = require('../enums/ProcessesStatuses');
const {Op} = require("sequelize");

/* GET all processes */
router.get('/', async function (req, res, next) {
    try {
        const {eager, length, offset} = routesUtils.getDefaultRequestParams(req);

        const processes = await postgres.Processes.entities(null, eager, null, length, offset);
        return res.status(200).json(resBuilder.success(processes));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting all processes"));
    }
});

// admin view: all processes including soft-deleted ones, enriched with
// total submission count and how many form instances are still in WAITING state
router.get('/admin', async function (req, res, next) {
    try {
        const processes = await postgres.Processes.findAll({
            include: [
                { model: postgres.ProcessesGroups, as: 'processGroup' },
                { model: postgres.ProcessesTypes, as: 'processType' }
            ],
            order: [['updatedAt', 'DESC']],
            paranoid: false  // include soft-deleted processes
        });

        const enriched = await Promise.all(processes.map(async (p) => {
            const submissionsCount = await postgres.ProcessesInstances.count({
                where: { processId: p.id }
            });

            // need the instance IDs to count waiting form instances across all submissions
            const piIds = (await postgres.ProcessesInstances.findAll({
                where: { processId: p.id },
                attributes: ['id'],
                raw: true
            })).map(pi => pi.id);

            const awaitingCount = piIds.length > 0
                ? await postgres.FormsInstances.count({
                    where: { status: 'waiting', processInstanceId: { [Op.in]: piIds } }
                })
                : 0;

            return { ...p.toJSON(), submissionsCount, awaitingCount };
        }));

        return res.status(200).json(resBuilder.success(enriched));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while getting admin processes"));
    }
});

/* PATCH update process status */
router.patch('/:id/status', async function (req, res, next) {
    try {
        const processId = req.params.id;
        const { status } = req.body;

        const allowed = [processStatus.PUBLISHED, processStatus.UNPUBLISHED, processStatus.DELETED];
        if (!status || !allowed.includes(status)) {
            return res.status(400).json(resBuilder.fail("Invalid status value"));
        }

        const process = await postgres.Processes.findOne({ where: { id: processId }, paranoid: false });

        if (!process) {
            return res.status(404).json(resBuilder.fail("Process not found"));
        }

        if (status === processStatus.DELETED) {
            await process.destroy();
        } else {
            process.status = status;
            if (process.deletedAt) await process.restore();
            await process.save();
        }

        return res.status(200).json(resBuilder.success({ id: processId, status }));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong while updating process status"));
    }
});

/* GET process by id */
router.get('/:id', async function (req, res, next) {
    try {
        const {eager} = routesUtils.getDefaultRequestParams(req);

        const processId = req.params.id;
        const processes = await postgres.Processes.entity({id: processId}, eager);

        if(!processes) {
            logger.error("Process not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        return res.status(200).json(resBuilder.success(processes));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting process by id"));
    }
});

// called by the FormStartNode n8n trigger; creates the process record if it doesn't exist yet
// (the setup workflow can run more than once so idempotency matters here)
router.post('/', async function (req, res, next) {
    try {
        const {name, processGroupName, processTypeName} = req.body;

        if(!name || !processGroupName || !processTypeName) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        // if the process was already created by a previous run, just return it
        let process = await postgres.Processes.entity({name: name});

        if(process) {
            return res.status(200).json(resBuilder.success(process));
        }

        // auto-create group and type records if they don't exist; they're just labels
        let processGroup = await postgres.ProcessesGroups.entity({name: processGroupName});
        let processType = await postgres.ProcessesTypes.entity({name: processTypeName});

        if(!processGroup) {
           processGroup = await postgres.ProcessesGroups.create({name: processGroupName});
        }

        if(!processType) {
            processType = await postgres.ProcessesTypes.create({name: processTypeName});
        }

        const process_data = {
            name: name,
            processGroupId: processGroup.dataValues.id,
            processTypeId: processType.dataValues.id,
            status: processStatus.UNPUBLISHED
        };

        process = await postgres.Processes.create(process_data);

        if(process) {
            return res.status(200).json(resBuilder.success(process));
        } else {
            return res.status(500).json(resBuilder.success("Process is not created"));
        }
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while creating process"));
    }
});

/* PUT update process */
router.put('/:id', async function (req, res, next) {
    try {
        const processId = req.params.id;

        const {processGroupName, processTypeName} = req.body;

        if(!processGroupName || !processTypeName) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        let processGroup = await postgres.ProcessesGroups.entity({name: processGroupName});
        let processType = await postgres.ProcessesTypes.entity({name: processTypeName});

        if(!processGroup) {
            processGroup = await postgres.ProcessesGroups.create({name: processGroupName});
        }

        if(!processType) {
            processType = await postgres.ProcessesTypes.create({name: processTypeName});
        }

        const process = await postgres.Processes.entity({id: processId});

        if(!process) {
            logger.error("Process not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        process.processGroupId = processGroup.dataValues.id;
        process.processTypeId = processType.dataValues.id;

        await process.save();

        return res.status(200).json(resBuilder.success(process));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while updating process"));
    }
});

module.exports = router;
