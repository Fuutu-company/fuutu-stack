import { webhooksConfig } from "./config";

/**
 * Calculate the next retry timestamp using exponential backoff with
 * equal jitter.
 *
 * Base delay = `2^attempt * retryBaseDelayMs`, capped at
 * `webhooksConfig.maxRetryDelayMs`. Jitter spreads retries into
 * `[base/2, base]` so a wave of deliveries that failed together doesn't
 * retry together (thundering herd).
 *
 * Keep in sync with the SQL backoff inside `recoverStaleDeliveries`
 * (@fuutu/db) — that query applies this same formula per row when
 * recovering crashed deliveries.
 */
export function calculateNextRetry(attempt: number): Date {
	const base = Math.min(
		2 ** attempt * webhooksConfig.retryBaseDelayMs,
		webhooksConfig.maxRetryDelayMs,
	);
	const jittered = base * (0.5 + Math.random() * 0.5);
	return new Date(Date.now() + jittered);
}
