// The last node in a process setup workflow.
// When the process builder runs, this node tells the backend that all form steps
// have been registered and the process definition is complete.
// The backend then deactivates the setup workflow so it doesn't run again.

import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';

const env = process.env;

export class FormEndNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TUKE Koncový uzol',
		name: 'formEndNode',
		icon: 'file:../shared/assets/tuke.svg',
		group: ['transform'],
		version: 1,
		description: 'Koncový uzol pre formulár.',
		defaults: {
			name: 'Koncový uzol',
		},
		inputs: ['main'],
		outputs: [],
		properties: [],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData();

		const output: any[] = [];

		// extract processId passed down from FormStartNode via the "input" marker
		let isInputDataFound = false;
		let processId: string | undefined;
		for (const inputField of inputData) {
			if (inputField?.json?.type === 'input') {
				processId = (inputField.json.data as { processId?: string })?.processId;
				isInputDataFound = true;
			}
		}

		// missing "input" item means the node is not wired correctly in the workflow
		if (!isInputDataFound) {
			throw new NodeOperationError(this.getNode(), `Koncový uzol nie je správne pripojený`);
		}

		const workflowId = this.getWorkflow().id;

		// signal the backend that this process definition is fully registered;
		// the backend will deactivate the setup workflow after this call
		await this.helpers.request({
			method: 'POST',
			url: `${env.NODE_APP_URL}/n8n/${processId}`,
			json: true,
			body: {
				workflowId,
			},
			headers: {
				'X-Service-Auth': env.INTERNAL_SECRET,
			},
			rejectUnauthorized: env.IS_PROD === 'true',
		});

		return [output];
	}
}
