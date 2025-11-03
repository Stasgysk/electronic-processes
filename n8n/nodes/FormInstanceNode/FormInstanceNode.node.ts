/* eslint-disable n8n-nodes-base/node-execute-block-wrong-error-thrown */
import {
	IWebhookFunctions,
	IExecuteFunctions,
	INodeExecutionData,
	IWebhookResponseData,
	INodeType,
	INodeTypeDescription,
	ICredentialDataDecryptedObject,
} from 'n8n-workflow';
import { credentialsProperty } from './description';
import { WebhookAuthorizationError } from './error';
import basicAuth from 'basic-auth';

const env = process.env;

export class FormInstanceNode implements INodeType {
	authPropertyName = 'authentication';

	description: INodeTypeDescription = {
		displayName: 'Proces formulára',
		name: 'formInstanceNode',
		icon: 'file:../shared/assets/tuke.svg',
		group: ['trigger'],
		version: 1,
		description: 'Spúšťač webhooku s čakaním/pokračovaním',
		defaults: { name: 'Proces formulára' },
		inputs: [],
		outputs: ['main'],
		outputNames: ['Po ukončení procesu'],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'start',
				authentication: 'none',
			},
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'response',
				path: 'resume',
				authentication: 'none',
				waitForWebhook: true,
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

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const resp = this.getResponseObject();

		try {
			await FormInstanceNode.validateAuth(this);
		} catch (error) {
			if (error instanceof WebhookAuthorizationError) {
				resp.writeHead(error.responseCode, { 'WWW-Authenticate': 'Basic realm="Webhook"' });
				resp.end(error.message);
				return { noWebhookResponse: true };
			}
			throw error;
		}

		const req = this.getRequestObject();
		const body = this.getBodyData();
		const path = req.path;

		if (path.endsWith('/start')) {
			const isFirstNode =
				body?.isFirstNode === true ||
				body?.isFirstNode === 'true' ||
				body?.isFirstNode === 1 ||
				body?.isFirstNode === '1';

			if (isFirstNode) {
				const afterWaitData: INodeExecutionData[] = [
					{
						json: {
							stage: 'after_wait',
							message: 'Vykonané okamžite, pretože isFirstNode=true',
							input: body,
						},
					},
				];

				await FormInstanceNode.continueWithNextForms(this, body.nextNodesIds);

				return {
					webhookResponse: {
						status: 'executed',
						message: 'Vykonané okamžite, pretože isFirstNode=true',
					},
					workflowData: [afterWaitData],
				};
			}

			return {
				webhookResponse: { status: 'waiting' },
			};
		}

		if (path.endsWith('/resume')) {
			const afterWaitData: INodeExecutionData[] = [
				{
					json: {
						stage: 'after_wait',
						message: 'Obnovené prostredníctvom webhooku',
						input: body,
					},
				},
			];

			await FormInstanceNode.continueWithNextForms(this, body.nextNodesIds);
			return { workflowData: [afterWaitData] };
		}

		return {
			webhookResponse: { error: 'Unknown webhook path' },
			workflowData: [[]],
		};
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = this.getInputData();
		const staticData = this.getWorkflowStaticData('node');
		const resumeUrl = staticData.resumeWebhookUrl;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-Service-Auth': `${env.INTERNAL_SECRET}`,
		};

		for (const item of inputData) {
			const formInstanceId = item.json.formInstanceId;
			const formProcessId = item.json.formProcessId;
			const body = { resumeUrl, formInstanceId, formProcessId };

			try {
				await this.helpers.httpRequest({
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

		const afterWaitData = inputData.map((item) => ({
			json: {
				stage: 'after_wait',
				message: 'Uzel vykonaný po čakaní/obnovení',
				input: item.json,
				resumeUrl,
			},
		}));

		return [afterWaitData];
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

		for (const formData of nextForms) {
			const url = `${env.N8N_WEBHOOK_URL}/webhook/${formData.formInstanceId}/start`;
			const body = {
				isFirstNode: false,
				nextNodesIds: [
					{
						formProcessId: formData.formProcessId,
						formInstanceId: formData.formInstanceId,
					},
				],
			};

			try {
				const response = await ctx.helpers.httpRequest({
					method: 'POST',
					url,
					headers: { 'Content-Type': 'application/json' },
					body,
					json: true,
				});

				console.log('Webhook /start response:', response);

				if (!response || !response.resumeUrl) {
					throw new Error(`No resumeUrl returned from ${url}. Response: ${JSON.stringify(response)}`);
				}

				// Отправляем resumeUrl обратно во внешний сервис
				await ctx.helpers.httpRequest({
					method: 'POST',
					url: `${env.NODE_APP_URL}/formsInstances/webhookUrl`,
					headers: {
						'Content-Type': 'application/json',
						'X-Service-Auth': `${env.INTERNAL_SECRET}`,
					},
					body: {
						resumeUrl: response.resumeUrl,
						formInstanceId: formData.formInstanceId,
						formProcessId: formData.formProcessId,
					},
					json: true,
				});

				resultData.push({
					formProcessId: formData.formProcessId,
					formInstanceId: formData.formInstanceId,
					resumeUrl: response.resumeUrl,
				});
			} catch (error) {
				throw new Error(`continueWithNextForms failed: ${(error as Error).message}`);
			}
		}

		return resultData;
	}
}
