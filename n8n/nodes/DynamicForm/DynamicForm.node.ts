/* eslint-disable n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options */
/* eslint-disable n8n-nodes-base/node-param-description-missing-from-dynamic-options */
/* eslint-disable n8n-nodes-base/node-param-display-name-miscased */
/* eslint-disable n8n-nodes-base/node-param-description-excess-final-period */

import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
	NodeOperationError,
} from 'n8n-workflow';

const env = process.env;

export class DynamicForm implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Formulár',
		name: 'dynamicForm',
		icon: 'file:../shared/assets/tuke.svg',
		group: ['transform'],
		version: 1,
		description: 'Vlastný formulár so skupinami a šablónami',
		defaults: {
			name: 'Formulár',
		},
		inputs: ['main'],
		inputNames: ['Hlavny vstup', 'Dopln. info'],
		outputs: [
			'main',
			{ type: NodeConnectionTypes.Main, displayName: 'Before form' },
			{ type: NodeConnectionTypes.Main, displayName: 'After form' },
		],
		properties: [
			{
				displayName: 'Spôsob určenia používateľov',
				name: 'userSelectionMethod',
				type: 'options',
				options: [
					{ name: 'Podľa skupiny používateľov', value: 'group' },
					{ name: 'Podľa e-mailov', value: 'emails' },
				],
				default: 'group',
			},
			{
				displayName: 'Skupina Používateľov',
				name: 'userGroup',
				type: 'options',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getUserGroups',
				},
				default: '',
				displayOptions: {
					show: {
						userSelectionMethod: ['group'],
					},
				},
			},
			{
				displayName: 'Definícia e-mailov používateľov',
				name: 'emailDefinitionType',
				type: 'options',
				options: [
					{
						name: 'Spoločná verzia – všetci môžu odpovedať',
						value: 'shared',
						description: 'Všetci dostanú tú istú verziu formulára.',
					},
					{
						name: 'Individuálne verzie – každý dostane svoju verziu',
						value: 'individual',
						description: 'Každý používateľ dostane vlastnú verziu formulára s popisom.',
					},
				],
				default: 'shared',
				displayOptions: {
					show: {
						userSelectionMethod: ['emails'],
					},
				},
			},
			{
				displayName: 'E-maily používateľov',
				name: 'sharedUserEmails',
				type: 'string',
				placeholder: 'email1@student.tuke.sk,email2@student.tuke.sk',
				default: '',
				required: true,
				description: 'Viac e-mailov oddelených čiarkou',
				displayOptions: {
					show: {
						userSelectionMethod: ['emails'],
						emailDefinitionType: ['shared'],
					},
				},
			},
			{
				displayName: 'Používatelia s vlastnými formulármi',
				name: 'individualUsers',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				displayOptions: {
					show: {
						userSelectionMethod: ['emails'],
						emailDefinitionType: ['individual'],
					},
				},
				options: [
					{
						name: 'user',
						displayName: 'Používateľ',
						values: [
							{
								displayName: 'E-Mail Používateľa',
								name: 'email',
								type: 'string',
								placeholder: 'email@student.tuke.sk',
								default: '',
								required: true,
							},
							{
								displayName: 'Sprievodný Text',
								name: 'note',
								type: 'string',
								placeholder: 'napr. Formulár o predmete 1',
								default: '',
							},
						],
					},
				],
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
								name: 'firstName',
								type: 'string',
								default: 'Meno',
								displayOptions: {
									show: {
										groupType: ['personal'],
									},
								},
							},
							{
								displayName: 'Názov Poľa',
								name: 'secondName',
								type: 'string',
								default: 'Priezvisko',
								displayOptions: {
									show: {
										groupType: ['personal'],
									},
								},
							},
							{
								displayName: 'Názov Poľa',
								name: 'birthDate',
								type: 'string',
								default: 'Dátum narodenia',
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
											/* eslint-disable n8n-nodes-base/node-param-display-name-miscased */
											{
												displayName: 'Typ Poľa',
												name: 'fieldType',
												type: 'options',
												// eslint-disable-next-line n8n-nodes-base/node-param-options-type-unsorted-items
												options: [
													{ name: 'Text', value: 'string' },
													{ name: 'Číslo', value: 'number' },
													{ name: 'Dátum', value: 'date' },
													{ name: 'Áno/nie', value: 'boolean' },
													{ name: 'Checkbox', value: 'checkbox' },
													{ name: 'Súbor', value: 'file' },
												],
												default: 'string',
											},
											/* eslint-enable n8n-nodes-base/node-param-display-name-miscased */
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
					url: `${env.NODE_APP_URL}/usersGroups`,
					json: true,
					headers: {
						'X-Service-Auth': env.INTERNAL_SECRET,
					},
					rejectUnauthorized: env.IS_PROD === 'true',
				});

				return response.data.map((group: any) => ({
					name: group.name,
					value: group.name,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData(0);
		//const additionalInfo = this.getInputData(1);

		const formGroups = this.getNodeParameter('formGroups', 0) as {
			group: Array<any>;
		};

		const output: any[] = [];
		const beforeOutput: any[] = [];
		const afterOutput: any[] = [];

		let form_data = [];
		for (const group of formGroups.group) {
			const groupType = group.groupType;

			let data: any = { type: groupType };

			data.groupName = group.groupName || '';
			switch (groupType) {
				case 'personal':
					data.firstName = { name: group.firstName, type: 'string', value: '' };
					data.secondName = { name: group.secondName, type: 'string', value: '' };
					data.birthDate = { name: group.birthDate, type: 'date', value: '' };
					break;

				case 'contact':
					data.email = { name: group.email, type: 'string', value: '' };
					data.phone = { name: group.phone, type: 'string', value: '' };
					break;

				case 'address':
					data.city = { name: group.city, type: 'string', value: '' };
					data.postal = { name: group.postal, type: 'number', value: '' };
					data.street = { name: group.street, type: 'string', value: '' };
					break;

				case 'custom':
					break;
			}

			if (group.customFields && group.customFields.field) {
				data.customFields = data.customFields || {};
				for (const field of group.customFields.field) {
					data[field.fieldName] = { name: field.fieldName, type: field.fieldType, value: "" };
				}
			}

			delete data.customFields;

			form_data.push(data);
		}
		output.push({ json: { type: 'formData', formData: form_data } });

		let dataToAdd: any = { type: 'input' };
		let isInputDataFound = null;

		let prevFormData;
		let isNodeConnected = false;
		console.log(inputData);
		for (const inputField of inputData) {
			if (inputField?.json?.type === 'input') {
				isInputDataFound = inputField.json.data;
			}

			if (inputField?.json.type === 'prevNode') {
				isNodeConnected = true;
			}

			if (inputField?.json.type === 'formData') {
				prevFormData = inputField.json.formData;
			}
		}

		if (!isInputDataFound) {
			isInputDataFound = inputData[0].json;
		}

		dataToAdd.data = isInputDataFound;
		output.push({ json: dataToAdd });

		const workflowId = this.getWorkflow().id;
		const nodeName = this.getNode().name;

		const response = await this.helpers.request({
			method: 'GET',
			url: `${env.NODE_APP_URL}/n8n/${workflowId}/${nodeName}`,
			json: true,
			headers: {
				'X-Service-Auth': env.INTERNAL_SECRET,
			},
			rejectUnauthorized: env.IS_PROD === 'true',
		});

		let prevNodeInfo: any = { type: 'prevNode', id: response.data.id };
		output.push({ json: prevNodeInfo });

		let prevNodeIds = null;
		if (isNodeConnected) {
			prevNodeIds = response.data.prevNodeIds;
		}

		const userSelectionMethod = this.getNodeParameter('userSelectionMethod', 0, '') as string;

		interface UserConfig {
			type: 'group' | 'emails';
			data: any;
		}

		let userConfig: UserConfig = { type: 'group', data: {} };

		if (userSelectionMethod === 'group') {
			const userGroup = this.getNodeParameter('userGroup', 0, '') as string;

			if (!userGroup) {
				throw new NodeOperationError(this.getNode(), 'Pole "Skupina používateľov" je povinné.');
			}

			userConfig = {
				type: 'group',
				data: {
					groupName: userGroup,
				},
			};
		} else if (userSelectionMethod === 'emails') {
			const emailDefinitionType = this.getNodeParameter('emailDefinitionType', 0, '') as string;

			const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

			if (emailDefinitionType === 'shared') {
				const sharedUserEmails = this.getNodeParameter('sharedUserEmails', 0, '') as string;

				if (!sharedUserEmails.trim()) {
					throw new NodeOperationError(this.getNode(), 'Pole "E-maily používateľov" je povinné.');
				}

				const emails = sharedUserEmails
					.split(',')
					.map((e) => e.trim())
					.filter(Boolean);

				for (const email of emails) {
					if (!emailRegex.test(email)) {
						throw new NodeOperationError(this.getNode(), `Neplatný e-mail: ${email}`);
					}
				}

				userConfig = {
					type: 'emails',
					data: {
						mode: 'shared',
						emails,
					},
				};
			} else if (emailDefinitionType === 'individual') {
				const individualUsers = this.getNodeParameter('individualUsers', 0, { user: [] }) as {
					user: Array<{ email: string; note?: string }>;
				};

				const emailEntries = (individualUsers.user || []).map((u) => ({
					email: (u.email || '').trim(),
					note: u.note || '',
				}));

				if (emailEntries.length === 0) {
					throw new NodeOperationError(this.getNode(), 'Musíte zadať aspoň jedného používateľa.');
				}

				for (const entry of emailEntries) {
					if (!emailRegex.test(entry.email)) {
						throw new NodeOperationError(this.getNode(), `Neplatný e-mail: ${entry.email}`);
					}
				}

				userConfig = {
					type: 'emails',
					data: {
						mode: 'individual',
						users: emailEntries,
					},
				};
			}
		}

		await this.helpers.request({
			method: 'POST',
			url: `${env.NODE_APP_URL}/forms`,
			json: true,
			body: {
				formName: nodeName,
				formId: response.data.id,
				formData: form_data,
				processId: dataToAdd.data.processId,
				prevFormIds: prevNodeIds,
				userConfig: userConfig,
			},
			headers: {
				'X-Service-Auth': env.INTERNAL_SECRET,
			},
			rejectUnauthorized: env.IS_PROD === 'true',
		});

		beforeOutput.push({
			json: {
				input: {
					formData: prevFormData,
					formName: '',
					formSubmittedByUser: {
						id: '',
						name: '',
						userGroupId: '',
						email: '',
					},
					nextFormData: form_data,
					nextFormName: '',
					assigneeEmails: '',
				},
			},
		});

		afterOutput.push({
			json: {
				formData: form_data,
				formName: '',
				formSubmittedByUser: {
					id: '',
					name: '',
					userGroupId: '',
					email: '',
				},
			},
		});

		return [output, beforeOutput, afterOutput];
	}
}
