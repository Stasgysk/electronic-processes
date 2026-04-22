import {
	ITriggerFunctions,
	ITriggerResponse,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

const env = process.env;

// The entry point of every process workflow.
// When the workflow is activated (run once at setup time), this node fires immediately
// and creates the process record in the backend database.
// The processId returned is passed downstream so subsequent DynamicForm nodes
// know which process they belong to.
export class FormStartNode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TUKE Počiatočný uzol',
		name: 'formStartNode',
		icon: 'file:../shared/assets/tuke.svg',
		group: ['trigger'],
		version: 1,
		description: 'Počiatočný uzol pre formulár.',
		defaults: {
			name: 'Počiatočný uzol',
		},
		inputs: [],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Názov Formulára',
				name: 'name',
				type: 'string',
				placeholder: 'Žiadosť o 2. opravný termín',
				default: '',
				required: true,
			},
			// process group and type are used for categorisation in the admin panel
			{
				displayName: 'Okruh Procesu',
				name: 'formProcessGroup',
				type: 'options',
				options: [
					{ name: 'Manažérsky', value: 'management' },
					{ name: 'Hlavný', value: 'main' },
					{ name: 'Pomocné', value: 'support' },
				],
				default: 'main',
				required: true,
			},
			{
				displayName: 'Manažérske Procesy',
				name: 'managementProcesses',
				type: 'options',
				options: [
					{ name: 'Zodpovednosť Manažmentu', value: 'responsibility' },
					{ name: 'Marketing', value: 'marketing' },
					{ name: 'Riadenie Dokumentácie, Záznamov a Komunikácia', value: 'documentation' },
					{ name: 'Manažérstvo Zdrojov', value: 'sources' },
				],
				default: 'responsibility',
				required: true,
				displayOptions: {
					show: {
						formProcessGroup: ['management'],
					},
				},
			},
			{
				displayName: 'Hlavné Procesy',
				name: 'mainProcesses',
				type: 'options',
				options: [
					{ name: 'Vzdelávanie', value: 'education' },
					{ name: 'Výskum a Vývoj', value: 'research' },
					{ name: 'Podnikanie', value: 'business' },
				],
				default: 'education',
				required: true,
				displayOptions: {
					show: {
						formProcessGroup: ['main'],
					},
				},
			},
			{
				displayName: 'Pomocné Procesy',
				name: 'supportProcesses',
				type: 'options',
				// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
				options: [
					{ name: 'Prevádzkovanie Knižnice', value: 'library' },
					{ name: 'Zabezpečenie Infraštruktúry', value: 'infrastructure' },
					{ name: 'Metrologické Zabezpečenie', value: 'metrological' },
					{ name: 'Zmluvné Vzťahy', value: 'contractual' },
					{ name: 'Nakupovanie', value: 'shopping' },
					{ name: 'Monitorovanie, Analýza, Zlepšovanie', value: 'monitoring' },
				],
				default: 'library',
				required: true,
				displayOptions: {
					show: {
						formProcessGroup: ['support'],
					},
				},
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const workflowName = this.getWorkflow().name;
		let name = this.getNodeParameter('name', 0) as string;

		if (!name) {
			name = workflowName || 'Neznámy formulár';
		}
		const formProcessGroup = this.getNodeParameter('formProcessGroup', 0) as string;

		// pick the sub-type based on whichever group was selected
		let selectedProcessType: string | undefined;

		if (formProcessGroup === 'management') {
			selectedProcessType = this.getNodeParameter('managementProcesses', 0) as string;
		} else if (formProcessGroup === 'main') {
			selectedProcessType = this.getNodeParameter('mainProcesses', 0) as string;
		} else if (formProcessGroup === 'support') {
			selectedProcessType = this.getNodeParameter('supportProcesses', 0) as string;
		}

		// create the process record in the backend and get back the assigned processId
		const response = await this.helpers.request({
			method: 'POST',
			url: `${env.NODE_APP_URL}/processes`,
			json: true,
			body: {
				name: name,
				processGroupName: formProcessGroup,
				processTypeName: selectedProcessType,
			},
			headers: {
				'X-Service-Auth': env.INTERNAL_SECRET,
			},
			rejectUnauthorized: env.IS_PROD === 'true',
		});

		const data = {
			name,
			formProcessGroup,
			selectedProcessType,
			processId: response.data.id,
		};

		const emitData = () => {
			this.emit([this.helpers.returnJsonArray([data])]);
		};

		// small delay so downstream nodes are ready to receive the event
		const timeout = global.setTimeout(emitData, 200);

		return {
			closeFunction: async () => {
				global.clearTimeout(timeout);
			},
		};
	}
}
