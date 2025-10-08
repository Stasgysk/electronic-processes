import {
	NodeConnectionType,
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
	NodeOperationError,
} from 'n8n-workflow';

const env = process.env;

export class FormEndNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Koncový uzol',
		name: 'formEndNode',
		group: ['transform'],
		version: 1,
		description: 'Koncový uzol pre formulár.',
		defaults: {
			name: 'Koncový uzol',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [],
		properties: [],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData();

		const output: any[] = [];

		let isInputDataFound = false;
		let processId: string | undefined;
		for(const inputField of inputData) {
			if (inputField?.json?.type === "input") {
				processId = (inputField.json.data as { processId?: string })?.processId;
				isInputDataFound = true;
			}
		}

		if(!isInputDataFound) {
			throw new NodeOperationError(this.getNode(), `Koncový uzol nie je správne pripojený`);
		}

		await this.helpers.request({
			method: 'POST',
			url: `https://nodeapp:4000/n8n/${processId}`,
			json: true,
			body: {},
			headers: {
				'X-Service-Auth': env.INTERNAL_SECRET,
			},
			rejectUnauthorized: env.IS_PROD === "true",
		});

		return [output];
	}
}
