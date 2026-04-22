/* eslint-disable n8n-nodes-base/node-execute-block-wrong-error-thrown */

// Pauses a running workflow until a user submits their form, then resumes it.
//
// How it works:
// 1. execute() is called when the workflow first reaches this node.
//    - If isFirstNode is true (the form is the very first step, no waiting needed),
//      it skips the pause and immediately triggers the next form's start webhook.
//    - Otherwise it calls putExecutionToWait(WAIT_INDEFINITELY) to suspend the workflow,
//      then posts the resulting resumeUrl to the backend so the frontend can call it later.
// 2. When the user submits their form the frontend POSTs to resumeUrl, n8n wakes up
//    the execution and calls webhook() here instead.
// 3. webhook() authenticates the caller, then fires continueWithNextForms() to start
//    whatever form instances come next in the process chain.

import {
	ICredentialDataDecryptedObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeTypeDescription,
	IWebhookFunctions,
	WAIT_INDEFINITELY,
} from 'n8n-workflow';
import { Webhook } from '../shared/functions/Webhook/Webhook.node';
import { credentialsProperty } from '../shared/functions/description';
import { WebhookAuthorizationError } from '../shared/functions/error';
import basicAuth from 'basic-auth';

const env = process.env;

export class FormInstanceResumeNode extends Webhook {
	authPropertyName = 'authentication';

	description: INodeTypeDescription = {
		displayName: 'Čakanie na odoslanie formulára',
		name: 'formInstanceResumeNode',
		group: ['organization'],
		icon: 'file:../shared/assets/tuke.svg',
		version: 1,
		description: 'Čaká na odoslanie formulára pred pokračovaním v vykonávaní.',
		defaults: {
			name: 'Čakanie na odoslanie formulára',
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


	// called when the user's form submission hits the resume webhook
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
		// trigger the next form instances now that this one is done
		// @ts-ignore
		await FormInstanceResumeNode.continueWithNextForms(context, body);

		return {
			workflowData: [[{ json: body }]],
		};
	}


	// called the first time the workflow reaches this node
	async execute(context: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const inputData = context.getInputData();
		// @ts-ignore
		const isFirstNode = inputData[0].json.input.isFirstNode;

		// if this is the first step in the process there is no form to wait for,
		// so skip the pause and go straight to triggering the next forms
		if(isFirstNode) {
			// @ts-ignore
			await FormInstanceResumeNode.continueWithNextForms(context, inputData[0].json.input);

			return [
				[
					{
						json: {
							message: 'Vykonávanie bez čakania'
						},
					},
				],
			];
		}

		// pause the workflow here; n8n stores the execution state until the resume webhook is called
		await context.putExecutionToWait(WAIT_INDEFINITELY);

		// build the resume URL that the frontend will POST to when the user submits
		let resumeUrl = (context.evaluateExpression('{{$execution.resumeUrl}}', 0) + "/form-instance-resume");

		// make sure the URL uses https in production (n8n may return http internally)
		if(env.N8N_EDITOR_BASE_URL && env.N8N_EDITOR_BASE_URL.includes("https")) {
			resumeUrl = resumeUrl.replace("http", "https")
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-Service-Auth': `${env.INTERNAL_SECRET}`,
		};

		// send the resume URL to the backend for each form instance that needs it
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
					await context.helpers.request({
						method: 'POST',
						url: `${env.NODE_APP_URL}/formsInstances/webhookUrl`,
						headers,
						body,
						json: true,
						rejectUnauthorized: env.IS_PROD === "true",
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
						message: 'Čakanie na webhook...',
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

	// looks up the assigned users for each next form instance, then calls their start webhooks
	// so those form instances become active for the right people
	static async continueWithNextForms(ctx: IExecuteFunctions | IWebhookFunctions, inputBody: any) {
		const resultData: any[] = [];

		// the start webhook on the next workflow is protected by basic auth, same credentials as this node
		const creds = await ctx.getCredentials<ICredentialDataDecryptedObject>('httpBasicAuth')

		if (!creds || !creds.user || !creds.password) {
			throw new Error('Missing credentials');
		}

		const authHeader = 'Basic ' + Buffer.from(`${creds.user}:${creds.password}`).toString('base64');

		try {
			for (const formData of inputBody.nextNodesIds) {
				// get the list of email addresses assigned to this form instance
				const response = await ctx.helpers.request({
					method: 'GET',
					url: `${env.NODE_APP_URL}/formsInstances/users/${formData.formInstanceId}`,
					headers: {
						'X-Service-Auth': env.INTERNAL_SECRET,
					},
					json: true,
					rejectUnauthorized: env.IS_PROD === 'true',
				});

				let emails = response.data.emails;

				// each form instance has its own workflow; hit its /start webhook to kick it off
				const url = `${env.N8N_EDITOR_BASE_URL}/webhook/${formData.formInstanceId}/start`;
				const body = {
					isFirstNode: false,
					nextNodesIds: [
						{
							formProcessId: formData.formProcessId,
							formInstanceId: formData.formInstanceId,
						},
					],
					formData: inputBody.formData,
					formSubmittedByUser: inputBody.formSubmittedByUser,
					formName: inputBody.formName,
					nextFormData: inputBody.nextFormData,
					nextFormName: inputBody.nextFormName,
					assigneeEmails: emails,
				};

				await ctx.helpers.request({
					method: 'POST',
					url,
					headers: {
						'Content-Type': 'application/json',
						Authorization: authHeader,
					},
					body,
					json: true,
					rejectUnauthorized: env.IS_PROD === 'true',
				});
			}
		} catch (error) {
			throw new Error(`continueWithNextForms failed: ${(error as Error).message}`);
		}

		return resultData;
	}
}
