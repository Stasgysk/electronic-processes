/* eslint-disable n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options */

import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

const env = process.env;

export class ProcessActionNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Akcia procesu',
		name: 'processActionNode',
		icon: 'file:../shared/assets/tuke.svg',
		group: ['transform'],
		version: 1,
		description: 'Definuje automatickú akciu (napr. e-mail) ako krok procesu. Pripoj akčné uzly k výstupu "Akcia".',
		defaults: {
			name: 'Akcia procesu',
		},
		inputs: ['main'],
		outputs: [
			{ type: NodeConnectionTypes.Main, displayName: 'Continue' },
			{ type: NodeConnectionTypes.Main, displayName: 'Action' },
		],
		properties: [
			{
				displayName: 'Názov akcie',
				name: 'actionName',
				type: 'string',
				default: '',
				required: true,
				description: 'Popis akcie (len informatívny)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData();

		let processId: any = null;
		for (const item of inputData) {
			if (item.json?.type === 'input') {
				processId = (item.json.data as any)?.processId ?? null;
			}
		}

		const workflowId = this.getWorkflow().id;
		const nodeName = this.getNode().name;

		const [nodeInfo, workflowResponse] = await Promise.all([
			this.helpers.request({
				method: 'GET',
				url: `${env.NODE_APP_URL}/n8n/${workflowId}/${nodeName}`,
				json: true,
				headers: { 'X-Service-Auth': env.INTERNAL_SECRET },
				rejectUnauthorized: env.IS_PROD === 'true',
			}),
			this.helpers.request({
				method: 'GET',
				url: `${env.NODE_APP_URL}/n8n/${workflowId}`,
				json: true,
				headers: { 'X-Service-Auth': env.INTERNAL_SECRET },
				rejectUnauthorized: env.IS_PROD === 'true',
			}),
		]);

		const nodeId: string = nodeInfo.data.id;
		const prevNodeIds: string | null = nodeInfo.data.prevNodeIds || null;

		const wfNodes: any[] = workflowResponse.data?.nodes || [];
		const wfConnections: any = workflowResponse.data?.connections || {};

		const prevIdList = prevNodeIds ? prevNodeIds.split(',').filter(Boolean) : [];
		const sourceFormNode = wfNodes.find((n: any) => prevIdList.includes(n.id) && n.type === 'CUSTOM.dynamicForm');
		const sourceFormName: string | null = sourceFormNode?.name ?? null;

		const myConns = wfConnections[nodeName];
		const actionOutputConns: any[] = myConns?.main?.[1] || [];

		const actionNodes: any[] = [];
		const actionConnections: Record<string, any> = {};
		let firstActionNodeName: string | null = null;

		if (actionOutputConns.length > 0) {
			firstActionNodeName = actionOutputConns[0].node as string;

			const visited = new Set<string>();
			const queue: string[] = [firstActionNodeName as string];

			while (queue.length > 0) {
				const currentName = queue.shift()!;
				if (visited.has(currentName)) continue;
				visited.add(currentName);

				const node = wfNodes.find((n: any) => n.name === currentName);
				if (!node) continue;

				actionNodes.push(JSON.parse(JSON.stringify(node)));

				const nodeConns = wfConnections[currentName];
				if (nodeConns?.main) {
					for (const outputConns of nodeConns.main as any[][]) {
						for (const conn of outputConns) {
							if (!visited.has(conn.node)) {
								queue.push(conn.node);
							}
						}
					}
				}
			}

			for (const actionNode of actionNodes) {
				const nodeConns = wfConnections[actionNode.name];
				if (nodeConns?.main) {
					const filtered: any[][] = (nodeConns.main as any[][]).map((outputConns: any[]) =>
						outputConns.filter((c: any) => visited.has(c.node))
					);
					actionConnections[actionNode.name] = { main: filtered };
				}
			}
		}

		await this.helpers.request({
			method: 'POST',
			url: `${env.NODE_APP_URL}/forms`,
			json: true,
			body: {
				formName: nodeName,
				formId: nodeId,
				formData: [],
				processId,
				prevFormIds: prevNodeIds,
				userConfig: {
					type: 'action',
					data: {
						actionWorkflowNodes: {
							firstNodeName: firstActionNodeName,
							nodes: actionNodes,
							connections: actionConnections,
							sourceFormName,
						},
					},
				},
			},
			headers: { 'X-Service-Auth': env.INTERNAL_SECRET },
			rejectUnauthorized: env.IS_PROD === 'true',
		});

		const prevNodeInfo = { type: 'prevNode', id: nodeId };
		const dataToAdd = { type: 'input', data: { processId } };
		const continueOutput: INodeExecutionData[] = [
			{ json: { type: 'formData', formData: [] } },
			{ json: dataToAdd },
			{ json: prevNodeInfo },
		];

		const actionPlaceholder: INodeExecutionData[] = actionNodes.length > 0
			? actionNodes.map(n => ({ json: { _actionNode: n.name, processId } }))
			: [{ json: {} }];

		return [continueOutput, actionPlaceholder];
	}
}
