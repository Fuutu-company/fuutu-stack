import type { WebhookConfig } from "./types";

// Kit defaults — kit buyers can tune these values to match their delivery
// requirements (retry aggressiveness, timeout tolerance).
export const webhooksConfig: WebhookConfig = {
	maxRetries: 5,
	retryBaseDelayMs: 1000,
	// Backoff cap — also enforced by recoverStaleDeliveries in @fuutu/db,
	// which receives this value from processPendingDeliveries.
	maxRetryDelayMs: 60 * 60 * 1000,
	timeoutMs: 10000,
	staleProcessingTimeoutMs: 5 * 60 * 1000,
	// Cap the endpoint's response body before persisting it on the delivery
	// row — an unbounded `res.text()` would let a receiver bloat the table.
	maxResponseBodyBytes: 64 * 1024,
	// Cap the serialized event payload at dispatch time — an unbounded
	// `payload` record would let a single event bloat the delivery table.
	maxPayloadBytes: 64 * 1024,
};
