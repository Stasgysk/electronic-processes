/* eslint-disable n8n-nodes-base/node-param-display-name-wrong-for-dynamic-options */
/* eslint-disable n8n-nodes-base/node-param-description-missing-from-dynamic-options */
/* eslint-disable n8n-nodes-base/node-param-display-name-miscased */
/* eslint-disable n8n-nodes-base/node-param-description-excess-final-period */

// Represents a single form step in a process.
// During the process setup run, this node:
//   1. Converts the designer's field configuration into a form_data schema.
//   2. Registers the form as a step in the backend (/forms endpoint), linking it
//      to the process and its predecessor steps.
//   3. Outputs the schema on three branches:
//      - main (output 0): the form definition + prevNode marker, passed to the next step
//      - "Before form" (output 1): placeholder data for nodes that run before the form is shown
//      - "After form" (output 2): placeholder data for nodes that run after the form is submitted
//
// User assignment is resolved at runtime by the backend using the userConfig saved here.
// Three modes:
//   - group: all members of a named user group get the form
//   - role: backend finds users with this role in the process initiator's org unit
//   - emails: explicit list (shared or per-user)

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
		displayName: 'TUKE Formulár',
		name: 'dynamicForm',
		icon: 'file:../shared/assets/tuke.svg',
		group: ['transform'],
		version: 1,
		description: 'Vlastný formulár so skupinami a šablónami',
		defaults: {
			name: 'Formulár',
		},
		inputs: ['main'],
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
					{ name: 'Podľa roly', value: 'role' },
				],
				default: 'group',
			},
			{
				displayName: 'Rola',
				name: 'roleName',
				type: 'options',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getOrgRoles',
				},
				default: '',
				description:
					'Rola bude automaticky priradená podľa organizačnej jednotky iniciátora procesu.',
				displayOptions: {
					show: {
						userSelectionMethod: ['role'],
					},
				},
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
			// populates the "Skupina Používateľov" dropdown in the node UI
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
			// populates the "Rola" dropdown; deduplicates by name because the same role
			// can exist in multiple org units but the designer only picks the role name
			async getOrgRoles(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const env = process.env;
				const response = await this.helpers.request({
					method: 'GET',
					url: `${env.NODE_APP_URL}/orgRoles`,
					json: true,
					headers: {
						'X-Service-Auth': env.INTERNAL_SECRET,
					},
					rejectUnauthorized: env.IS_PROD === 'true',
				});

				const seen = new Set<string>();
				return (response.data || [])
					.filter((role: any) => {
						if (seen.has(role.name)) return false;
						seen.add(role.name);
						return true;
					})
					.map((role: any) => ({
						name: role.name,
						value: role.name,
					}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData(0);

		const formGroups = this.getNodeParameter('formGroups', 0) as {
			group: Array<any>;
		};

		const output: any[] = [];
		const beforeOutput: any[] = [];
		const afterOutput: any[] = [];

		// convert the designer's group config into the flat form_data schema stored in the backend
		let form_data = [];
		for (const group of formGroups.group) {
			const groupType = group.groupType;

			let data: any = { type: groupType };

			data.groupName = group.groupName || '';
			// built-in group types get a fixed set of fields; custom groups only have customFields
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

			// merge any extra custom fields defined on top of a built-in or custom group
			if (group.customFields && group.customFields.field) {
				data.customFields = data.customFields || {};
				for (const field of group.customFields.field) {
					data[field.fieldName] = { name: field.fieldName, type: field.fieldType, value: '' };
				}
			}

			// customFields was just a staging area; the actual fields are now on data directly
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

			// presence of a "prevNode" item means this form has a predecessor in the chain
			if (inputField?.json.type === 'prevNode') {
				isNodeConnected = true;
			}

			if (inputField?.json.type === 'formData') {
				prevFormData = inputField.json.formData;
			}
		}

		// fall back to raw input if no "input" typed item was found
		if (!isInputDataFound) {
			isInputDataFound = inputData[0].json;
		}

		dataToAdd.data = isInputDataFound;
		output.push({ json: dataToAdd });

		const workflowId = this.getWorkflow().id;
		const nodeName = this.getNode().name;

		// fetch this node's DB record to get its id and the ids of its preceding nodes
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

		// only include prevNodeIds when this form is actually connected to a preceding step
		let prevNodeIds = null;
		if (isNodeConnected) {
			prevNodeIds = response.data.prevNodeIds;
		}

		const userSelectionMethod = this.getNodeParameter('userSelectionMethod', 0, '') as string;

		interface UserConfig {
			type: 'group' | 'emails' | 'role';
			data: any;
		}

		let userConfig: UserConfig = { type: 'group', data: {} };

		if (userSelectionMethod === 'role') {
			const roleName = this.getNodeParameter('roleName', 0, '') as string;
			if (!roleName) {
				throw new NodeOperationError(this.getNode(), 'Pole "Rola" je povinné.');
			}
			userConfig = {
				type: 'role',
				data: { roleName },
			};
		} else if (userSelectionMethod === 'group') {
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
				// all listed emails get the same form instance
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
				// each user gets their own form instance with an optional personal note
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

		// register the form step in the backend; this is what the process runner reads later
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

		// before/after outputs carry placeholder data for nodes on those branches
		// (e.g. a "Send assignment email" node on the Before branch)
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
