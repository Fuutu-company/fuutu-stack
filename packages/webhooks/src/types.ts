/**
 * @fuutu/webhooks — webhook delivery worker types.
 */

export interface WebhookEndpoint {
	id: string;
	url: string;
	secret: string;
	events: string[];
	isActive: boolean;
}

export interface WebhookEvent {
	id: string;
	type: string;
	payload: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
	success: boolean;
	responseCode: number | null;
	responseBody: string | null;
	error: string | null;
}

export interface WebhookConfig {
	maxRetries: number;
	retryBaseDelayMs: number;
	timeoutMs: number;
	staleProcessingTimeoutMs: number;
}
