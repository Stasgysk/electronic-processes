/* eslint-disable n8n-nodes-base/node-execute-block-wrong-error-thrown */
import {
	IWebhookFunctions,
	IWebhookResponseData,
	INodeType,
	INodeTypeDescription,
	ICredentialDataDecryptedObject,
} from 'n8n-workflow';
import { credentialsProperty } from '../shared/functions/description';
import { WebhookAuthorizationError } from '../shared/functions/error';
import basicAuth from 'basic-auth';

export class FormInstanceStartNode implements INodeType {
	authPropertyName = 'authentication';

	description: INodeTypeDescription = {
		displayName: 'Spúšťač inštancie formulára',
		name: 'formInstanceStartNode',
		group: ['trigger'],
		icon: 'file:../shared/assets/tuke.svg',
		version: 1,
		description: 'Spustí proces po prijatí požiadavky POST.',
		defaults: { name: 'Spúšťač inštancie formulára' },
		inputs: [],
		outputs: ['main', 'main'],
		outputNames: ['', ''],
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

		const firstOutput = [
			{
				json: {
					step: 'first',
					message: 'Logika pred priradením formy',
					input: body,
				},
			},
		];

		const secondOutput = [
			{
				json: {
					step: 'second',
					message: '',
					dependsOn: 'first branch completed',
					input: body,
				},
			},
		];

		return {
			webhookResponse: { ok: true },
			workflowData: [firstOutput, secondOutput],
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
