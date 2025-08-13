/* global logger */
/* global resBuilder */
/* global routesUtils */

let express = require('express');
const {Op} = require("sequelize");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require('uuid');
const axios = require("axios");
let nanoid;
(async () => {
    const { nanoid: nanoidFn } = await import('nanoid');
    nanoid = nanoidFn;
})();
let router = express.Router();

const authCookie = axios.post(
    `${process.env.N8N_BASE_URL}rest/login`,
    {
        emailOrLdapLoginId: process.env.N8N_API_USER_EMAIL,
        password: process.env.N8N_API_USER_PASSWORD,
    },
    { withCredentials: true }
).then(r => {
    const cookieHeader = r.headers['set-cookie'];
    return cookieHeader.find(c => c.startsWith('n8n-auth='));
});


/* GET n8n workflow entity by id */
router.get('/:id', async function (req, res, next) {
    try {
        const workflowEntityId = req.params.id;
        const workflowEntity = await postgres.WorkflowEntities.entity({id: workflowEntityId});

        if(!workflowEntity) {
            logger.error("Workflow entity not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        return res.status(200).json(resBuilder.success(workflowEntity));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting n8n workflow by id"));
    }
});

/* GET n8n node id and previous node ids, by workflow id and node name */
router.get('/:id/:name', async function (req, res, next) {
    try {
        const workflowEntityId = req.params.id;
        const nodeName = req.params.name.toString();
        const workflowEntity = await postgres.WorkflowEntities.entity({id: workflowEntityId});

        if(!workflowEntity) {
            logger.error("Workflow entity not found");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const nodesConnections = workflowEntity.dataValues.connections;
        const nodes = workflowEntity.dataValues.nodes;

        if(!nodes) {
            logger.error("Workflow nodesConnections do not exists");
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const prevNodeNames = [];
        for(let prevNodeName in nodesConnections) {
            for(let nodeConnections of nodesConnections[prevNodeName].main) {
                for(let innerNodeConnection of nodeConnections) {
                    if(innerNodeConnection.node === nodeName && !prevNodeNames.includes(innerNodeConnection.node)) {
                        prevNodeNames.push(prevNodeName);
                    }
                }
            }
        }

        let nodeId;
        const prevNodeIds = [];
        for(let node of nodes) {
            if(node.name === nodeName) {
                nodeId = node.id;
            }
            if(prevNodeNames.includes(node.name)) {
                prevNodeIds.push(node.id);
            }
        }

        return res.status(200).json(resBuilder.success({id: nodeId, prevNodeIds: prevNodeIds.join(',')}));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting node id by workflow id and node name"));
    }
});

/* POST create workflow for each formStatus */
router.post('/:id', async function (req, res, next) {
    try {
        const processId = req.params.id;

        let forms = await postgres.Forms.entities({processId: processId});
        const foundProcess = await postgres.Processes.entity({id: processId});

        if(!forms || forms.length === 0) {
            logger.error(`No forms found for processId: ${processId}`);
            return res.status(400).json(resBuilder.fail("Bad request"));
        }

        const areTempForms = forms.filter(f => f.dataValues.formName === "TempName");
        forms = forms.filter(f => f.dataValues.formName !== "TempName");

        if(areTempForms && areTempForms.length > 0) {
            await removeTempForms(areTempForms);
        }

        const filePath = path.join(__dirname, '..', 'workflows', 'processWorkflowTemplate.json');
        let processWorkflowTemplateFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        const templateWorkflow = await postgres.WorkflowEntities.entity({name: processWorkflowTemplateFile.name});
        const templateSharedWorkflow = await postgres.SharedWorkflow.entity({workflowId: templateWorkflow.id});

        for(let form of forms) {
            const versionId = form.formId;
            const isProcessWorkflowExists = await postgres.WorkflowEntities.entity({versionId: versionId});

            await updateOrCreateProcessWorkflowEntity(isProcessWorkflowExists, processWorkflowTemplateFile, versionId, foundProcess.name, form.formName, templateSharedWorkflow)
        }

        return res.status(200).json(resBuilder.success("Process workflows created"));
    } catch (e) {
        logger.error(e);
        return res.status(500).json(resBuilder.error("Something went wrong, while getting node id by workflow id and node name"));
    }
});

async function removeTempForms(areTempForms){
    for(let tempForm of areTempForms){
        const tempFormsDependencies = await postgres.FormsDependencies.findAll({
            where: {
                [Op.or]: [
                    { formId: tempForm.dataValues.formId },
                    { prevFormId: tempForm.dataValues.formId }
                ]
            }
        });

        for(let tempFormDependency of tempFormsDependencies){
            await tempFormDependency.destroy();
        }

        await tempForm.destroy();
    }
}

async function updateOrCreateProcessWorkflowEntity(processWorkflow, newData, versionId, processName, formName, sharedWorkflowDataTemplate) {
    let isExist = false;
    if(processWorkflow) {
        isExist = true;
    }

    const workflowId = isExist ? processWorkflow.id : nanoid(16);
    const workflowName = `${processName}/${formName} process workflow`;

    let processWorkflowTemplateCopy = {...newData};

    processWorkflowTemplateCopy.name = workflowName;
    processWorkflowTemplateCopy.versionId = versionId;
    processWorkflowTemplateCopy.id = workflowId;

    for(let node of processWorkflowTemplateCopy.nodes) {
        node.id = uuidv4();

        switch(node.name) {
            case "Webhook":
                node.webhookId = versionId;
                node.parameters.path = versionId;
                break;
            case "Wait":
                node.webhookId = versionId;
                break;
            default:
                break;
        }
    }

    if(isExist){
        processWorkflow.name = processWorkflowTemplateCopy.name;
        processWorkflow.nodes = processWorkflowTemplateCopy.nodes;
        processWorkflow.connections = processWorkflowTemplateCopy.connections;
        processWorkflow.active = processWorkflowTemplateCopy.active;
        processWorkflow.settings = processWorkflowTemplateCopy.settings;
        processWorkflow.staticData = processWorkflowTemplateCopy.staticData;
        processWorkflow.meta = processWorkflowTemplateCopy.meta;
        processWorkflow.parentFolder = processWorkflowTemplateCopy.staticData;

        await processWorkflow.save();
        logger.info(`Process Workflow updated: ${processWorkflowTemplateCopy.name}`);
    } else {
        const sharedWorkflowData = {
            workflowId: workflowId,
            projectId: sharedWorkflowDataTemplate.projectId,
            role: sharedWorkflowDataTemplate.role,
        }

        await postgres.WorkflowEntities.create(processWorkflowTemplateCopy);
        await postgres.SharedWorkflow.create(sharedWorkflowData);

        await axios.patch(
            `${process.env.N8N_BASE_URL}rest/workflows/${workflowId}`,
            { active: true },
            {
                headers: {
                    Cookie: authCookie
                }
            }
        );
        logger.info(`Process Workflow created: ${processWorkflowTemplateCopy.name}`);
    }
}

module.exports = router;
