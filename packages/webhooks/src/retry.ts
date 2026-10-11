import { webhooksConfig } from "./config";

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Calculate the next retry timestamp using exponential backoff with
 * equal jitter.
 *
 * Base delay = `2^attempt * retryBaseDelayMs`, capped at 1 hour.
 * Jitter spreads retries into `[base/2, base]` so a wave of deliveries that
 * failed together doesn't retry together (thundering herd).
 */
export function calculateNextRetry(attempt: number): Date {
	const base = Math.min(
		2 ** attempt * webhooksConfig.retryBaseDelayMs,
		ONE_HOUR_MS,
	);
	const jittered = base * (0.5 + Math.random() * 0.5);
	return new Date(Date.now() + jittered);
}
