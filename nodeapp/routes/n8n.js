/* global logger */
/* global resBuilder */
/* global routesUtils */

let express = require('express');
let router = express.Router();
const {
	removeTempForms,
	buildWorkflowData,
	buildActionWorkflowData,
	createWorkflow,
	updateWorkflow,
} = require('../services/n8nService');
const path = require('path');
const fs = require('fs');
let nanoid;
(async () => {
	const { nanoid: nanoidFn } = await import('nanoid');
	nanoid = nanoidFn;
})();

/* GET n8n workflow entity by id */
router.get('/:id', async function (req, res, next) {
	try {
		const workflowEntityId = req.params.id;
		const workflowEntity = await postgres.WorkflowEntities.entity({ id: workflowEntityId });

		if (!workflowEntity) {
			logger.error('Workflow entity not found');
			return res.status(400).json(resBuilder.fail('Bad request'));
		}

		return res.status(200).json(resBuilder.success(workflowEntity));
	} catch (e) {
		logger.error(e);
		return res
			.status(500)
			.json(resBuilder.error('Something went wrong, while getting n8n workflow by id'));
	}
});

/* GET n8n node id and previous node ids, by workflow id and node name */
router.get('/:id/:name', async function (req, res, next) {
	try {
		const workflowEntityId = req.params.id;
		const nodeName = req.params.name.toString();
		const workflowEntity = await postgres.WorkflowEntities.entity({ id: workflowEntityId });

		if (!workflowEntity) {
			logger.error('Workflow entity not found');
			return res.status(400).json(resBuilder.fail('Bad request'));
		}

		const nodesConnections = workflowEntity.dataValues.connections;
		const nodes = workflowEntity.dataValues.nodes;

		if (!nodes) {
			logger.error('Workflow nodesConnections do not exists');
			return res.status(400).json(resBuilder.fail('Bad request'));
		}

		const transparentNodeTypes = ['CUSTOM.conditionalFormRouter'];

		function resolvePrevNodeIds(targetName, allNodes, allConnections, visited = new Set()) {
			if (visited.has(targetName)) return [];
			visited.add(targetName);

			const directPrevNames = [];
			for (const prevName in allConnections) {
				for (const outputConns of allConnections[prevName].main || []) {
					for (const conn of outputConns) {
						if (conn.node === targetName && !directPrevNames.includes(prevName)) {
							directPrevNames.push(prevName);
						}
					}
				}
			}

			const resolvedIds = [];
			for (const prevName of directPrevNames) {
				const prevNode = allNodes.find(n => n.name === prevName);
				if (!prevNode) continue;
				if (transparentNodeTypes.includes(prevNode.type)) {
					resolvedIds.push(...resolvePrevNodeIds(prevName, allNodes, allConnections, visited));
				} else {
					resolvedIds.push(prevNode.id);
				}
			}
			return resolvedIds;
		}

		let nodeId;
		for (let node of nodes) {
			if (node.name === nodeName) {
				nodeId = node.id;
				break;
			}
		}

		const prevNodeIds = resolvePrevNodeIds(nodeName, nodes, nodesConnections);

		return res
			.status(200)
			.json(resBuilder.success({ id: nodeId, prevNodeIds: prevNodeIds.join(',') }));
	} catch (e) {
		logger.error(e);
		return res
			.status(500)
			.json(
				resBuilder.error(
					'Something went wrong, while getting node id by workflow id and node name',
				),
			);
	}
});

/* POST create workflow for each formStatus */
router.post('/:id', async function (req, res, next) {
	try {
		const processId = req.params.id;
		const { workflowId } = req.body;

		let forms = await postgres.Forms.entities({ processId: processId });
		const foundProcess = await postgres.Processes.entity({ id: processId });

		if (!forms || forms.length === 0) {
			logger.error(`No forms found for processId: ${processId}`);
			return res.status(400).json(resBuilder.fail('Bad request'));
		}

		if(!workflowId) {
			logger.error(`No workflowId or nodeId found for processId: ${processId}`);
			return res.status(400).json(resBuilder.fail('Bad request'));
		}

		const processBuilderWorkflow = await postgres.WorkflowEntities.entity({ id: workflowId });

		const areTempForms = forms.filter((f) => f.dataValues.formName === 'TempName');
		forms = forms.filter((f) => f.dataValues.formName !== 'TempName');

		if (areTempForms && areTempForms.length > 0) {
			await removeTempForms(areTempForms);
		}

		const filePath = path.join(__dirname, '..', 'workflows', 'processWorkflowTemplate.json');
		let processWorkflowTemplateFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));

		const actionFilePath = path.join(__dirname, '..', 'workflows', 'actionWorkflowTemplate.json');
		let actionWorkflowTemplateFile = JSON.parse(fs.readFileSync(actionFilePath, 'utf8'));

		const templateWorkflow = await postgres.WorkflowEntities.entity({
			name: processWorkflowTemplateFile.name,
		});
		const templateSharedWorkflow = await postgres.SharedWorkflow.entity({
			workflowId: templateWorkflow.id,
		});

		const existingFolder = await postgres.Folder.findOne({
			where: { name: foundProcess.name, projectId: templateSharedWorkflow.projectId },
		});
		const folderId = existingFolder ? existingFolder.id : nanoid(16);

		for (let form of forms) {
			const workflowName = `${foundProcess.name}/${form.formName} process workflow`;
			const existingWorkflow = await postgres.WorkflowEntities.entity({ name: workflowName });

			if (form.formType === 'action') {
				const { data: workflowData } = buildActionWorkflowData(
					actionWorkflowTemplateFile,
					form,
					existingWorkflow,
					foundProcess.name
				);
				if (existingWorkflow) {
					await updateWorkflow(existingWorkflow, workflowData, templateSharedWorkflow, folderId, foundProcess.name);
				} else {
					await createWorkflow(workflowData, templateSharedWorkflow, folderId, foundProcess.name);
				}
			} else {
				const { data: workflowData } = buildWorkflowData(
					processWorkflowTemplateFile,
					form.formId,
					foundProcess.name,
					form.formName,
					existingWorkflow,
					processBuilderWorkflow
				);
				if (existingWorkflow) {
					await updateWorkflow(existingWorkflow, workflowData, templateSharedWorkflow, folderId, foundProcess.name);
				} else {
					await createWorkflow(workflowData, templateSharedWorkflow, folderId, foundProcess.name);
				}
			}
		}

		return res.status(200).json(resBuilder.success('Process workflows created'));
	} catch (e) {
		logger.error(e);
		return res
			.status(500)
			.json(resBuilder.error('Something went wrong, while creating process workflows'));
	}
});

module.exports = router;
