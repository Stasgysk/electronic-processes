// import { v4 as uuidv4 } from 'uuid';

import {
	IExecuteFunctions, ILoadOptionsFunctions,
	INodeExecutionData, INodePropertyOptions, INodeType,
	INodeTypeDescription,
	NodeConnectionType, NodeOperationError
} from 'n8n-workflow';

const env = process.env;

export class DynamicForm implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Formulár',
		name: 'dynamicForm',
		group: ['transform'],
		version: 1,
		description: 'Vlastný formulár so skupinami a šablónami',
		defaults: {
			name: 'Formulár',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		properties: [
			{
				displayName: 'Skupina Používateľov',
				name: 'userGroup',
				type: 'options',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getUserGroups',
				},
				default: '',
			},
			{
				displayName: 'Definovať Príjemcov?',
				name: 'addEmails',
				type: 'boolean',
				default: false,
			},
			{
				displayName: 'E-Maily Používateľov',
				name: 'userEmails',
				type: 'string',
				placeholder: 'email1@student.tuke.sk,email2@student.tuke.sk',
				default: '',
				required: true,
				description: 'Viac e-mailov oddelených čiarkou',
				displayOptions: {
					show: {
						addEmails: [true],
					},
				},
			},
			{
				displayName: 'Formulárové Skupiny',
				name: 'formGroups',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				options: [
					{
						name: 'group',
						displayName: 'Skupina',
						// eslint-disable-next-line n8n-nodes-base/node-param-fixed-collection-type-unsorted-items
						values: [
							{
								displayName: 'Group Type',
								name: 'groupType',
								type: 'options',
								options: [
									{ name: 'Osobné Údaje', value: 'personal' },
									{ name: 'Kontaktné Informácie', value: 'contact' },
									{ name: 'Adresné Informácie', value: 'address' },
									{ name: 'Vlastné', value: 'custom' },
								],
								default: 'personal',
							},
							{
								displayName: 'Názov Skupiny',
								name: 'groupName',
								type: 'string',
								default: '',
								displayOptions: {
									show: {
										groupType: ['custom'],
									},
								},
							},
							{
								displayName: 'Názov Skupiny',
								name: 'groupName',
								type: 'string',
								default: 'Adresné Informácie',
								displayOptions: {
									show: {
										groupType: ['address'],
									},
								},
							},
							{
								displayName: 'Názov Skupiny',
								name: 'groupName',
								type: 'string',
								default: 'Kontaktné Informácie',
								displayOptions: {
									show: {
										groupType: ['contact'],
									},
								},
							},
							{
								displayName: 'Názov Skupiny',
								name: 'groupName',
								type: 'string',
								default: 'Osobné Údaje',
								displayOptions: {
									show: {
										groupType: ['personal'],
									},
								},
							},
							{
								displayName: 'Názov Poľa',
								name: 'email',
								type: 'string',
								placeholder: 'meno.priezvisko@tuke.sk',
								default: 'E-Mail',
								displayOptions: {
									show: {
										groupType: ['contact'],
									},
								},
							},
							{
								displayName: 'Názov Poľa',
								name: 'phone',
								type: 'string',
								default: 'Telefónny Kontakt',
								displayOptions: {
									show: {
										groupType: ['contact'],
									},
								},
							},
							{
								displayName: 'Názov Poľa',
								name: 'city',
								type: 'string',
								default: 'Mesto',
								displayOptions: {
									show: {
										groupType: ['address'],
									},
								},
							},
							{
								displayName: 'Názov Poľa',
								name: 'postal',
								type: 'string',
								default: 'PSČ',
								displayOptions: {
									show: {
										groupType: ['address'],
									},
								},
							},
							{
								displayName: 'Názov Poľa',
								name: 'street',
								type: 'string',
								default: 'Ulica',
								displayOptions: {
									show: {
										groupType: ['address'],
									},
								},
							},
							{
								displayName: 'Vlastné Polia',
								name: 'customFields',
								type: 'fixedCollection',
								typeOptions: {
									multipleValues: true,
								},
								options: [
									{
										name: 'field',
										displayName: 'Field',
										values: [
											{
												displayName: 'Názov Poľa',
												name: 'fieldName',
												type: 'string',
												default: '',
											},
										],
									},
								],
								default: {},
							},
						],
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getUserGroups(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const env = process.env;
				const response = await this.helpers.request({
					method: 'GET',
					url: 'https://nodeapp:4000/usersGroups',
					json: true,
					headers: {
						'X-Service-Auth': env.INTERNAL_SECRET,
					},
					rejectUnauthorized: env.IS_PROD === "true",
				});

				return response.data.map((group: any) => ({
					name: group.name,
					value: group.name,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData();

		const formGroups = this.getNodeParameter('formGroups', 0) as {
			group: Array<any>;
		};

		const output: any[] = [];

		let form_data = [];
		for (const group of formGroups.group) {
			const groupType = group.groupType;

			let data: any = { type: groupType };

			data.groupName = group.groupName || '';
			switch (groupType) {
				case 'personal':
					break;

				case 'contact':
					data.email = group.email;
					data.phone = group.phone;
					break;

				case 'address':
					data.city = group.city;
					data.postal = group.postal;
					data.street = group.street;
					break;

				case 'custom':
					break;
			}

			if (group.customFields && group.customFields.field) {
				data.customFields = data.customFields || {};
				for (const field of group.customFields.field) {
					data[field.fieldName] = field.fieldValue || '';
				}
			}

			output.push({ json: data });
			form_data.push(data);
		}

		let dataToAdd: any = { type: "input"};
		let isInputDataFound = null;

		let isNodeConnected = false;
		for(const inputField of inputData) {
			if (inputField?.json?.type === "input") {
				isInputDataFound = inputField.json.data;
			}

			if (inputField?.json.type === "prevNode") {
				isNodeConnected = true;
			}
		}

		if(!isInputDataFound) {
			isInputDataFound = inputData[0].json;
		}

		dataToAdd.data = isInputDataFound;
		output.push({json: dataToAdd});

		const workflowId = this.getWorkflow().id;
		const nodeName = this.getNode().name;

		const response = await this.helpers.request({
			method: 'GET',
			url: `https://nodeapp:4000/n8n/${workflowId}/${nodeName}`,
			json: true,
			headers: {
				'X-Service-Auth': env.INTERNAL_SECRET,
			},
			rejectUnauthorized: env.IS_PROD === "true",
		});

		let prevNodeInfo: any = { type: "prevNode", "id": response.data.id};
		output.push({json: prevNodeInfo});

		let prevNodeIds = null;
		if(isNodeConnected) {
			prevNodeIds = response.data.prevNodeIds;
		}

		const userGroup = this.getNodeParameter('userGroup', 0) as string;
		const addEmails = this.getNodeParameter('addEmails', 0) as boolean;

		let userEmails = "";
		if(addEmails) {
			userEmails = this.getNodeParameter('userEmails', 0) as string;

			const emails = userEmails.split(',').map(e => e.trim());

			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

			for (const email of emails) {
				if (!emailRegex.test(email)) {
					throw new NodeOperationError(this.getNode(), `Neplatný e-mail: ${email}`);
				}
			}
		}


		await this.helpers.request({
			method: 'POST',
			url: `https://nodeapp:4000/forms`,
			json: true,
			body: {
				"formName": nodeName,
				"formId": response.data.id,
				"formData": form_data,
				"processId": dataToAdd.data.processId,
				"prevFormIds": prevNodeIds,
				"userGroupName": userGroup,
				"userEmails": userEmails
			},
			headers: {
				'X-Service-Auth': env.INTERNAL_SECRET,
			},
			rejectUnauthorized: env.IS_PROD === "true",
		});

		return [output];
	}
}
