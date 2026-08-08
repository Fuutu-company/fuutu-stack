import type { WebhookConfig } from "./types";

// Kit defaults — kit buyers can tune these values to match their delivery
// requirements (retry aggressiveness, timeout tolerance).
export const webhooksConfig: WebhookConfig = {
	maxRetries: 5,
	retryBaseDelayMs: 1000,
	timeoutMs: 10000,
	staleProcessingTimeoutMs: 5 * 60 * 1000,
};
