/* global logger */
/* global resBuilder */
/* global routesUtils */

let express = require('express');
let router = express.Router();
const routesUtils = require("../utils/RoutesUtils");
const processStatus = require('../enums/ProcessesStatuses');

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

/* POST create new process */
router.post('/', async function (req, res, next) {
    try {
        const {name, processGroupName, processTypeName} = req.body;

        if(!name || !processGroupName || !processTypeName) {
            logger.error("Required fields are not present");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        let process = await postgres.Processes.entity({name: name});

        if(process) {
            return res.status(200).json(resBuilder.success(process));
        }

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
