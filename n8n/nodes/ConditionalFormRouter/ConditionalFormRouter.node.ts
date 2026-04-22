/* eslint-disable n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options */
/* eslint-disable n8n-nodes-base/node-param-description-missing-from-dynamic-options */

import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';

const env = process.env;

// Placed after a DynamicForm node to branch the workflow based on a field value
// submitted in that form. Has two outputs: "Condition met" and "Else".
//
// During the process setup run, this node saves the branching rule to the backend.
// At runtime (when the form is actually submitted), the backend evaluates the condition
// and activates only the form instances on the matching branch.
export class ConditionalFormRouter implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TUKE Podmienkový smerovač',
		name: 'conditionalFormRouter',
		icon: 'file:../shared/assets/tuke.svg',
		group: ['transform'],
		version: 1,
		description: 'Smeruje proces na základe hodnoty poľa z predchádzajúceho formulára',
		defaults: {
			name: 'Podmienkový smerovač',
		},
		inputs: ['main'],
		outputs: [
			{ type: NodeConnectionTypes.Main, displayName: 'Condition met' },
			{ type: NodeConnectionTypes.Main, displayName: 'Else' },
		],
		properties: [
			{
				displayName: 'Názov poľa',
				name: 'fieldName',
				type: 'string',
				default: '',
				required: true,
				description: 'Kľúč poľa v predchádzajúcom formulári (napr. schvalenie)',
			},
			{
				displayName: 'Operátor',
				name: 'operator',
				type: 'options',
				options: [
					{ name: 'Rovná sa', value: 'equals' },
					{ name: 'Nerovná sa', value: 'notEquals' },
					{ name: 'Obsahuje', value: 'contains' },
					{ name: 'Väčšie ako', value: 'greaterThan' },
					{ name: 'Menšie ako', value: 'lessThan' },
				],
				default: 'equals',
				required: true,
			},
			{
				displayName: 'Očakávaná hodnota',
				name: 'expectedValue',
				type: 'string',
				default: '',
				required: true,
				description: 'Hodnota, s ktorou sa porovnáva (napr. true, áno, 1)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData();

		const fieldName = this.getNodeParameter('fieldName', 0) as string;
		const operator = this.getNodeParameter('operator', 0) as string;
		const expectedValue = this.getNodeParameter('expectedValue', 0) as string;

		// extract processId and the id of the form that came just before this router node
		let processId: any = null;
		let sourceFormId: string | null = null;

		for (const item of inputData) {
			if (item.json?.type === 'input') {
				processId = (item.json.data as any)?.processId ?? null;
			}
			if (item.json?.type === 'prevNode') {
				sourceFormId = (item.json as any).id as string;
			}
		}

		const workflowId = this.getWorkflow().id;
		const nodeName = this.getNode().name;

		// fetch the workflow definition to find out which node is on the "condition met" branch
		const workflowResponse = await this.helpers.request({
			method: 'GET',
			url: `${env.NODE_APP_URL}/n8n/${workflowId}`,
			json: true,
			headers: { 'X-Service-Auth': env.INTERNAL_SECRET },
			rejectUnauthorized: env.IS_PROD === 'true',
		});

		const wfNodes: any[] = workflowResponse.data?.nodes || [];
		const wfConnections: any = workflowResponse.data?.connections || {};

		// output[0] = "Condition met" branch — we want the first node on that path
		const myConns = wfConnections[nodeName];
		const branch0Conns: any[] = myConns?.main?.[0] || [];
		const targetNodeName: string | undefined = branch0Conns[0]?.node;
		const targetNode = targetNodeName ? wfNodes.find((n: any) => n.name === targetNodeName) : null;
		const targetFormId: string | null = targetNode?.id ?? null;

		// save the condition rule to the backend so it can be evaluated at runtime
		if (processId && sourceFormId && targetFormId) {
			try {
				await this.helpers.request({
					method: 'POST',
					url: `${env.NODE_APP_URL}/formConditions`,
					json: true,
					body: {
						processId,
						sourceFormId,
						targetFormId,
						fieldName,
						operator,
						expectedValue,
					},
					headers: { 'X-Service-Auth': env.INTERNAL_SECRET },
					rejectUnauthorized: env.IS_PROD === 'true',
				});
			} catch (error) {
				throw new Error(`ConditionalFormRouter: failed to store condition: ${(error as Error).message}`);
			}
		}

		// pass the input through on both outputs — the actual branching happens at runtime in the backend
		const passthrough = inputData.map(item => ({ json: item.json }));
		return [passthrough, passthrough];
	}
}
