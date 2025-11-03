/* eslint-disable n8n-nodes-base/node-execute-block-wrong-error-thrown */
import {
	ICredentialDataDecryptedObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
	IWebhookFunctions,
	WAIT_INDEFINITELY,
} from 'n8n-workflow';
import { Webhook } from './Webhook/Webhook.node';
import { credentialsProperty } from './description';
import { WebhookAuthorizationError } from '../FormInstanceNode/error';
import basicAuth from 'basic-auth';

const env = process.env;

export class FormInstanceResumeNode extends Webhook {
	authPropertyName = 'authentication';

	description: INodeTypeDescription = {
		displayName: 'Form Instance Resume',
		name: 'formInstanceResumeNode',
		group: ['organization'],
		icon: 'file:../shared/assets/tuke.svg',
		version: 1,
		description: 'Waits for a webhook call before continuing execution',
		defaults: {
			name: 'Form Instance Resume',
		},
		inputs: ['main'],
		outputs: ['main'],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'form-instance-resume',
				restartWebhook: true,
			},
		],
		credentials: credentialsProperty(this.authPropertyName),
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				options: [
					{ name: 'None', value: 'none' },
					{ name: 'Basic Auth', value: 'basicAuth' },
				],
				default: 'none',
			},
		],
	};


	async webhook(context: IWebhookFunctions): Promise<{ workflowData: INodeExecutionData[][] }> {
		const resp = context.getResponseObject();
		const body = context.getBodyData();

		try {
			await FormInstanceResumeNode.validateAuth(context);
		} catch (error) {
			if (error instanceof WebhookAuthorizationError) {
				resp.writeHead(error.responseCode, { 'WWW-Authenticate': 'Basic realm="Webhook"' });
				resp.end(error.message);
				// @ts-ignore
				return { noWebhookResponse: true };
			}
			throw error;
		}

		console.log(body);
		// @ts-ignore
		await FormInstanceResumeNode.continueWithNextForms(context, body.nextNodesIds);

		return {
			workflowData: [[{ json: body }]],
		};
	}


	async execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = context.getInputData();
		// @ts-ignore
		const isFirstNode = inputData[0].json.input.isFirstNode;

		if(isFirstNode) {
			// @ts-ignore
			await FormInstanceResumeNode.continueWithNextForms(context, inputData[0].json.input.nextNodesIds);

			return [
				[
					{
						json: {
							message: 'Executing without waiting'
						},
					},
				],
			];
		}
		await context.putExecutionToWait(WAIT_INDEFINITELY);

		const resumeUrl = (context.evaluateExpression('{{$execution.resumeUrl}}', 0) + "/form-instance-resume")
			.replace("http", "https");

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-Service-Auth': `${env.INTERNAL_SECRET}`,
		};

		for (const item of inputData) {
			// @ts-ignore
			for(const nextNodeId of item.json.input.nextNodesIds) {
				console.log(nextNodeId);
				// @ts-ignore
				const formInstanceId = nextNodeId.formInstanceId;
				// @ts-ignore
				const formProcessId = nextNodeId.formProcessId;
				const body = { resumeUrl, formInstanceId, formProcessId };

				try {
					await context.helpers.httpRequest({
						method: 'POST',
						url: `${env.NODE_APP_URL}/formsInstances/webhookUrl`,
						headers,
						body,
						json: true,
					});
				} catch (error) {
					throw new Error(`Sending resumeUrl failed: ${(error as Error).message}`);
				}
			}
		}

		return [
			[
				{
					json: {
						message: 'Waiting for webhook...',
						resumeUrl,
					},
				},
			],
		];
	}

	static async validateAuth(ctx: IWebhookFunctions) {
		const req = ctx.getRequestObject();
		let expectedAuth: ICredentialDataDecryptedObject | undefined;
		try {
			expectedAuth = await ctx.getCredentials<ICredentialDataDecryptedObject>('httpBasicAuth');
		} catch {}

		if (expectedAuth === undefined || !expectedAuth.user || !expectedAuth.password) {
			throw new WebhookAuthorizationError(500, 'No authentication data defined on node!');
		}

		const providedAuth = basicAuth(req);
		if (!providedAuth) throw new WebhookAuthorizationError(401);

		if (providedAuth.name !== expectedAuth.user || providedAuth.pass !== expectedAuth.password) {
			throw new WebhookAuthorizationError(403);
		}
	}

	static async continueWithNextForms(ctx: IExecuteFunctions | IWebhookFunctions, nextForms: any) {
		const resultData: any[] = [];
		const creds = await ctx.getCredentials<ICredentialDataDecryptedObject>('httpBasicAuth')

		console.log(creds);
		if (!creds || !creds.user || !creds.password) {
			throw new Error('Missing credentials');
		}

		const authHeader = 'Basic ' + Buffer.from(`${creds.user}:${creds.password}`).toString('base64');

		for (const formData of nextForms) {
			const url = `${env.N8N_EDITOR_BASE_URL}/webhook/${formData.formInstanceId}/start`;
			const body = {
				isFirstNode: false,
				nextNodesIds: [
					{
						formProcessId: formData.formProcessId,
						formInstanceId: formData.formInstanceId,
					},
				],
			};

			console.log(url);

			try {
				await ctx.helpers.httpRequest({
					method: 'POST',
					url,
					headers: {
						'Content-Type': 'application/json',
						Authorization: authHeader,
					},
					body,
					json: true,
				});
			} catch (error) {
				throw new Error(`continueWithNextForms failed: ${(error as Error).message}`);
			}
		}

		return resultData;
	}
}
