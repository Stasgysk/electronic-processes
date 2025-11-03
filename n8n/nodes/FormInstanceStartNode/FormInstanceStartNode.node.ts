import {
	IWebhookFunctions,
	IWebhookResponseData,
	INodeType,
	INodeTypeDescription,
	ICredentialDataDecryptedObject,
} from 'n8n-workflow';
import { credentialsProperty } from './description';
import { WebhookAuthorizationError } from '../FormInstanceNode/error';
import basicAuth from 'basic-auth';

export class FormInstanceStartNode implements INodeType {
	authPropertyName = 'authentication';

	description: INodeTypeDescription = {
		displayName: 'Form Instance Start Trigger',
		name: 'formInstanceStartNode',
		group: ['trigger'],
		icon: 'file:../shared/assets/tuke.svg',
		version: 1,
		description: 'Starts the workflow when a POST request is received',
		defaults: { name: 'Form Start Trigger' },
		inputs: [],
		outputs: ['main'],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'start',
				authentication: 'none',
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
		const body = this.getBodyData();

		try {
			await FormInstanceStartNode.validateAuth(this);
		} catch (error) {
			if (error instanceof WebhookAuthorizationError) {
				resp.writeHead(error.responseCode, { 'WWW-Authenticate': 'Basic realm="Webhook"' });
				resp.end(error.message);
			}
			throw error;
		}

		return {
			webhookResponse: { ok: true },
			workflowData: [
				[
					{
						json: {
							message: 'Workflow started',
							input: body,
						},
					},
				],
			],
		};
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
}
