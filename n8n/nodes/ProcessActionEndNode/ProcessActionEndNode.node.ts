import {
	INodeType,
	INodeTypeDescription,
	IExecuteFunctions,
	INodeExecutionData,
} from 'n8n-workflow';

const env = process.env;

export class ProcessActionEndNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Koniec akcie',
		name: 'processActionEndNode',
		icon: 'file:../shared/assets/tuke.svg',
		group: ['transform'],
		version: 1,
		description: 'Označí akciu procesu ako dokončenú a pokračuje v smerovaní.',
		defaults: {
			name: 'Koniec akcie',
		},
		inputs: ['main'],
		outputs: [],
		properties: [],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData();

		let formProcessId: number | null = null;

		for (const item of inputData) {
			const nextNodesIds = (item.json?.input as any)?.nextNodesIds;
			if (Array.isArray(nextNodesIds) && nextNodesIds.length > 0) {
				formProcessId = nextNodesIds[0].formProcessId ?? null;
				break;
			}
		}

		if (!formProcessId) {
			throw new Error('ProcessActionEndNode: formProcessId not found in input');
		}

		await this.helpers.request({
			method: 'POST',
			url: `${env.NODE_APP_URL}/formsInstances/actionComplete`,
			json: true,
			body: { formProcessId },
			headers: {
				'X-Service-Auth': env.INTERNAL_SECRET,
			},
			rejectUnauthorized: env.IS_PROD === 'true',
		});

		return [[]];
	}
}
