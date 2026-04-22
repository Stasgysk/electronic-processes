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

// deletes temporary form records that were created during workflow parsing but
// didn't make it into the final process structure (e.g. conditions that were removed)
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

// builds the per-form submission workflow data by taking the master template and
// injecting the before/after nodes that were attached to the matching DynamicForm node
// in the process builder workflow.
function buildWorkflowData(templateData, versionId, processName, formName, existingWorkflow, processBuilderWorkflow) {
	const workflowId = existingWorkflow ? existingWorkflow.id : nanoid(16);
	const workflowName = `${processName}/${formName} process workflow`;

	let data = { ...templateData };
	data.name = workflowName;
	data.versionId = versionId;
	data.id = workflowId;

	// find the DynamicForm node in the original builder workflow that matches this form name
	const dynamicFormsNode = findAllWorkflowNodesByType(
		processBuilderWorkflow,
		"CUSTOM.dynamicForm"
	).filter(node => node.name === formName)[0];

	logger.debug("dynamicFormsNode: " + JSON.stringify(dynamicFormsNode));

	// output[1] = nodes connected to "Before form", output[2] = "After form"
	const connections = findConnectionsByNodeName(dynamicFormsNode, processBuilderWorkflow);
	const connectionsBefore = connections.main?.[1] ? connections.main[1] : [];
	const connectionsAfter = connections.main?.[2] ? connections.main[2] : [];
	logger.debug("connectionsBefore: "  + JSON.stringify(connectionsBefore));
	logger.debug("connectionsAfter: " + JSON.stringify(connectionsAfter));

	const nodesBefore = findAllNodesByConnection(connectionsBefore, processBuilderWorkflow);
	const nodesAfter = findAllNodesByConnection(connectionsAfter, processBuilderWorkflow);
	logger.debug("nodesBefore: "  + JSON.stringify(nodesBefore));
	logger.debug("nodesAfter: " + JSON.stringify(nodesAfter));

	// position the extra nodes so they show up nicely in the n8n canvas
	modifyNodes(nodesBefore, "before");
	modifyNodes(nodesAfter, "after");

	logger.debug("data: " +  JSON.stringify(data));
	logger.debug("nodes: " +  JSON.stringify(data.nodes));

	for(let node of data.nodes) {
		if(node.type === "CUSTOM.formInstanceStartNode") {
			// wire the before-form nodes right after the start node
			data.connections[node.name].main[0] = connectionsBefore;
			data.nodes = data.nodes.concat(nodesBefore);
		} else if(node.type === "CUSTOM.formInstanceResumeNode") {
			if(!data.connections[node.name]) {
				data.connections[node.name] = { main: []}
			}
			// wire the after-form nodes right after the resume node
			data.connections[node.name].main[0] = connectionsAfter;
			data.nodes = data.nodes.concat(nodesAfter);
		}
	}
	logger.debug("2data: " +  JSON.stringify(data));
	logger.debug("2nodes: " +  JSON.stringify(data.nodes));

	// assign fresh UUIDs to all nodes and update webhook IDs to use the new versionId
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

// creates a new workflow in n8n by writing it directly to the database
// (bypassing the REST API to avoid circular dependencies during startup)
async function createWorkflow(workflowData, sharedWorkflowTemplate, folderId, processName) {
	workflowData.parentFolderId = folderId;

	// create the folder for this process if it doesn't already exist
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

	// record an initial history entry so n8n can show the version timeline
	const workflowHistoryData = {
		versionId: workflowData.versionId,
		workflowId: workflow.dataValues.id,
		authors: 'system migration',
		nodes: workflow.dataValues.nodes,
		connections: workflow.dataValues.connections,
		name: null,
		autosaved: false,
	};

	await postgres.WorkflowHistory.findOrCreate({
		where: { versionId: workflowHistoryData.versionId },
		defaults: workflowHistoryData,
	});

	// grant access to the workflow within the same project as the template
	const sharedWorkflowData = {
		workflowId: workflowData.id,
		projectId: sharedWorkflowTemplate.projectId,
		role: sharedWorkflowTemplate.role,
	};

	await postgres.SharedWorkflow.create(sharedWorkflowData);

	await activateWorkflow(workflowData.id);
	logger.info(`Process Workflow created: ${workflowData.name}`);
}

// sets the positions of extra nodes so they don't overlap in the n8n canvas.
// before-form nodes go on the left side, after-form nodes on the right.
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
		posY -= 170; // stack them vertically so they don't overlap
	}
}

function findAllWorkflowNodesByType(workflow, type) {
	return workflow.dataValues.nodes.filter(node => node.type === type);
}

// resolves node objects from a list of connection references
function findAllNodesByConnection(connections, workflow) {
	const result = [];
	for (let connection of connections) {
		const node = workflow.dataValues.nodes.find(node => node.name === connection.node);
		if (node) {
			result.push(JSON.parse(JSON.stringify(node))); // deep copy so modifications don't affect the source
		}
	}
	return result;
}

function findConnectionsByNodeName(node, workflow) {
	const connections = workflow.dataValues.connections;
	return connections[node.name];
}

// updates an existing workflow's nodes and connections, then re-activates it
async function updateWorkflow(existingWorkflow, workflowData, sharedWorkflowTemplate, folderId, processName) {
	existingWorkflow.name = workflowData.name;
	existingWorkflow.nodes = workflowData.nodes;
	existingWorkflow.connections = workflowData.connections;
	existingWorkflow.active = workflowData.active;
	existingWorkflow.settings = workflowData.settings;
	existingWorkflow.staticData = workflowData.staticData;
	existingWorkflow.meta = workflowData.meta;
	existingWorkflow.parentFolder = workflowData.staticData;

	await existingWorkflow.save();

	await postgres.WorkflowHistory.findOrCreate({
		where: { versionId: existingWorkflow.versionId },
		defaults: {
			versionId: existingWorkflow.versionId,
			workflowId: existingWorkflow.id,
			authors: 'system migration',
			nodes: existingWorkflow.nodes,
			connections: existingWorkflow.connections,
			name: null,
			autosaved: false,
		},
	});

	// create shared access record if it's missing (can happen if the workflow was created externally)
	const existingShared = await postgres.SharedWorkflow.entity({ workflowId: existingWorkflow.id });
	if (!existingShared) {
		const folder = await postgres.Folder.entity({ id: folderId });
		if (!folder) {
			await postgres.Folder.create({
				id: folderId,
				name: processName,
				projectId: sharedWorkflowTemplate.projectId,
			});
		}

		await postgres.SharedWorkflow.create({
			workflowId: existingWorkflow.id,
			projectId: sharedWorkflowTemplate.projectId,
			role: sharedWorkflowTemplate.role,
		});
	}

	await activateWorkflow(existingWorkflow.id);
	logger.info(`Process Workflow updated: ${workflowData.name}`);
}

// activates a workflow via the n8n REST API.
// we need to fetch the current versionId first because n8n requires it for the activate call.
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

// builds workflow data for a ProcessActionNode — similar to buildWorkflowData but
// instead of before/after nodes it injects the action nodes defined in the process builder.
// these run automatically when the action step is triggered, without any user input.
function buildActionWorkflowData(templateData, form, existingWorkflow, processName) {
	const workflowId = existingWorkflow ? existingWorkflow.id : nanoid(16);
	const workflowName = `${processName}/${form.formName} process workflow`;

	let data = JSON.parse(JSON.stringify(templateData)); // deep copy so we don't mutate the template
	data.name = workflowName;
	data.versionId = form.formId;
	data.id = workflowId;

	const actionPayload = form.actionWorkflowNodes || { firstNodeName: null, nodes: [], connections: {}, sourceFormName: null };
	const actionNodes = actionPayload.nodes || [];
	modifyNodes(actionNodes, 'action');
	const actionConnections = actionPayload.connections || {};
	const firstActionNodeName = actionPayload.firstNodeName || null;
	const sourceFormName = actionPayload.sourceFormName || form.formName;

	data.nodes = data.nodes.concat(actionNodes);
	Object.assign(data.connections, actionConnections);

	// connect the start node directly to the first action node
	if (firstActionNodeName) {
		for (const node of data.nodes) {
			if (node.type === 'CUSTOM.formInstanceStartNode') {
				if (!data.connections[node.name]) {
					data.connections[node.name] = { main: [[], []] };
				}
				data.connections[node.name].main[0] = [{
					node: firstActionNodeName,
					type: 'main',
					index: 0,
				}];
				break;
			}
		}
	}

	// assign fresh IDs and set the webhook path to the form's id
	for (const node of data.nodes) {
		node.id = uuidv4();
		if (node.type === 'CUSTOM.formInstanceStartNode') {
			const oldName = node.name;
			node.name = sourceFormName;
			node.webhookId = form.formId;
			if (node.parameters && node.parameters.path !== undefined) {
				node.parameters.path = form.formId;
			}
			// update connection keys to match the renamed node
			if (data.connections[oldName]) {
				data.connections[sourceFormName] = data.connections[oldName];
				delete data.connections[oldName];
			}
		} else if (node.webhookId) {
			node.webhookId = form.formId;
		}
	}

	return { data, workflowId };
}

module.exports = {
	removeTempForms,
	buildWorkflowData,
	buildActionWorkflowData,
	createWorkflow,
	updateWorkflow,
	activateWorkflow,
};
