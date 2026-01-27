/* global logger */
/* global postgres */

const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { getAuthCookie } = require('../utils/getAuthCookie');

let nanoid;
(async () => {
	const { nanoid: nanoidFn } = await import('nanoid');
	nanoid = nanoidFn;
})();

async function removeTempForms(tempForms) {
	for (let tempForm of tempForms) {
		const tempFormsDependencies = await postgres.FormsDependencies.findAll({
			where: {
				[Op.or]: [
					{ formId: tempForm.dataValues.formId },
					{ prevFormId: tempForm.dataValues.formId },
				],
			},
		});

		for (let tempFormDependency of tempFormsDependencies) {
			await tempFormDependency.destroy();
		}

		await tempForm.destroy();
	}
}

function buildWorkflowData(templateData, versionId, processName, formName, existingWorkflow, processBuilderWorkflow) {
	const workflowId = existingWorkflow ? existingWorkflow.id : nanoid(16);
	const workflowName = `${processName}/${formName} process workflow`;

	let data = { ...templateData };
	data.name = workflowName;
	data.versionId = versionId;
	data.id = workflowId;

	const dynamicFormsNode = findAllWorkflowNodesByType(
		processBuilderWorkflow,
		"CUSTOM.dynamicForm"
	).filter(node => node.name === formName)[0];

	logger.debug("dynamicFormsNode: " + JSON.stringify(dynamicFormsNode));

	const connections = findConnectionsByNodeName(dynamicFormsNode, processBuilderWorkflow);
	const connectionsBefore = connections.main?.[1] ? connections.main[1] : [];
	const connectionsAfter = connections.main?.[2] ? connections.main[2] : [];
	logger.debug("connectionsBefore: "  + JSON.stringify(connectionsBefore));
	logger.debug("connectionsAfter: " + JSON.stringify(connectionsAfter));

	const nodesBefore = findAllNodesByConnection(connectionsBefore, processBuilderWorkflow);
	const nodesAfter = findAllNodesByConnection(connectionsAfter, processBuilderWorkflow);
	logger.debug("nodesBefore: "  + JSON.stringify(nodesBefore));
	logger.debug("nodesAfter: " + JSON.stringify(nodesAfter));

	modifyNodes(nodesBefore, "before");
	modifyNodes(nodesAfter, "after");

	logger.debug("data: " +  JSON.stringify(data));
	logger.debug("nodes: " +  JSON.stringify(data.nodes));
	for(let node of data.nodes) {
		if(node.type === "CUSTOM.formInstanceStartNode") {
			data.connections[node.name].main[0] = connectionsBefore;
			data.nodes = data.nodes.concat(nodesBefore);
		} else if(node.type === "CUSTOM.formInstanceResumeNode") {
			if(!data.connections[node.name]) {
				data.connections[node.name] = { main: []}
			}
			data.connections[node.name].main[0] = connectionsAfter;
			data.nodes = data.nodes.concat(nodesAfter);
		}
	}
	logger.debug("2data: " +  JSON.stringify(data));
	logger.debug("2nodes: " +  JSON.stringify(data.nodes));

	for (let node of data.nodes) {
		node.id = uuidv4();

		switch (node.name) {
			case 'Webhook':
				node.webhookId = versionId;
				node.parameters.path = versionId;
				break;
			case 'Wait':
				node.webhookId = versionId;
				break;
			default:
				if (node.webhookId) {
					node.webhookId = versionId;
				}
				break;
		}
	}

	return { data, workflowId };
}

async function createWorkflow(workflowData, sharedWorkflowTemplate, folderId, processName) {
	workflowData.parentFolderId = folderId;

	const folder = await postgres.Folder.entity({ id: folderId });
	if (!folder) {
		const folderData = {
			id: folderId,
			name: processName,
			projectId: sharedWorkflowTemplate.projectId,
		};

		await postgres.Folder.create(folderData);
	}

	const workflow = await postgres.WorkflowEntities.create(workflowData);

	const workflowHistoryData = {
		versionId: workflowData.versionId,
		workflowId: workflow.dataValues.id,
		authors: 'system migration',
		nodes: workflow.dataValues.nodes,
		connections: workflow.dataValues.connections,
		name: null,
		autosaved: false,
	};

	await postgres.WorkflowHistory.create(workflowHistoryData);

	const sharedWorkflowData = {
		workflowId: workflowData.id,
		projectId: sharedWorkflowTemplate.projectId,
		role: sharedWorkflowTemplate.role,
	};

	await postgres.SharedWorkflow.create(sharedWorkflowData);

	await activateWorkflow(workflowData.id);
	logger.info(`Process Workflow created: ${workflowData.name}`);
}

function modifyNodes(nodes, type) {
	let posX = 272;
	let posY = -160;
	if(type === "after") {
		posX = 512;
		posY = 48;
	}

	for(let node of nodes) {
		node.position = [posX, posY];
		node.disabled = false;
		posY -= 170;
	}

}

function findAllWorkflowNodesByType(workflow, type) {
	return workflow.dataValues.nodes.filter(node => node.type === type);
}

function findAllNodesByConnection(connections, workflow) {
	const result = [];
	for (let connection of connections) {
		const node = workflow.dataValues.nodes.find(node => node.name === connection.node);
		if (node) {
			result.push(JSON.parse(JSON.stringify(node)));
		}
	}
	return result;
}

function findConnectionsByNodeName(node, workflow) {
	const connections = workflow.dataValues.connections;

	return connections[node.name];
}

async function updateWorkflow(existingWorkflow, workflowData) {
	existingWorkflow.name = workflowData.name;
	existingWorkflow.nodes = workflowData.nodes;
	existingWorkflow.connections = workflowData.connections;
	existingWorkflow.active = workflowData.active;
	existingWorkflow.settings = workflowData.settings;
	existingWorkflow.staticData = workflowData.staticData;
	existingWorkflow.meta = workflowData.meta;
	existingWorkflow.parentFolder = workflowData.staticData;

	await existingWorkflow.save();
	await activateWorkflow(existingWorkflow.id);
	logger.info(`Process Workflow updated: ${workflowData.name}`);
}

async function activateWorkflow(workflowId) {
	const cookie = await getAuthCookie();

	const { data: workflow } = await axios.get(
		`${process.env.N8N_BASE_URL}rest/workflows/${workflowId}`,
		{ headers: { Cookie: cookie } },
	);

	await axios.post(
		`${process.env.N8N_BASE_URL}rest/workflows/${workflowId}/activate`,
		{ versionId: workflow.data.versionId },
		{
			headers: {
				'Content-Type': 'application/json',
				Cookie: cookie,
			},
		},
	);
}

module.exports = {
	removeTempForms,
	buildWorkflowData,
	createWorkflow,
	updateWorkflow,
	activateWorkflow,
};
