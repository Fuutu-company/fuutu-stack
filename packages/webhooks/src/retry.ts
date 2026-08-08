import { webhooksConfig } from "./config";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Calculate the next retry timestamp using exponential backoff.
 *
 * Delay = `2^attempt * retryBaseDelayMs`, capped at 1 hour.
 */
export function calculateNextRetry(attempt: number): Date {
	const delay = Math.min(
		2 ** attempt * webhooksConfig.retryBaseDelayMs,
		ONE_HOUR_MS,
	);
	return new Date(Date.now() + delay);
}
