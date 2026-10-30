import {
	claimPendingDeliveries,
	getWebhookForDelivery,
	recoverStaleDeliveries,
	updateDeliveryStatus,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { webhooksConfig } from "./config";
import { deliverWebhook } from "./deliver";
import { calculateNextRetry } from "./retry";

const log = createLogger({ scope: "webhooks:process" });

/**
 * Process pending webhook deliveries.
 *
 * First recovers deliveries stuck in `"processing"` (worker crash recovery),
 * then atomically claims pending/retrying deliveries (so multi-instance
 * workers never duplicate work), attempts delivery, and updates the existing
 * delivery record with the result. Failed deliveries are scheduled for
 * retry with backoff up to `maxRetries`.
 *
 * Deliveries are attempted strictly serially (one `await` per row). That is
 * deliberate for a starter kit: predictable load on receivers, no outbound
 * connection storms, and no extra concurrency machinery for kit buyers to
 * reason about. If you outgrow it, batch `deliverWebhook` calls here — the
 * claim/lock semantics in `claimPendingDeliveries` already support it.
 */
export async function processPendingDeliveries(): Promise<{
	processed: number;
	succeeded: number;
	failed: number;
}> {
	// Recovery consumes retry budget (a crashed attempt is an attempt), so
	// the backoff knobs are passed in — @fuutu/db cannot import this config
	// (dependency direction is webhooks → db).
	await recoverStaleDeliveries({
		timeoutMs: webhooksConfig.staleProcessingTimeoutMs,
		maxRetries: webhooksConfig.maxRetries,
		retryBaseDelayMs: webhooksConfig.retryBaseDelayMs,
		maxRetryDelayMs: webhooksConfig.maxRetryDelayMs,
	});
	const deliveries = await claimPendingDeliveries(100);

	let succeeded = 0;
	let failed = 0;

	for (const delivery of deliveries) {
		try {
			const webhook = await getWebhookForDelivery(delivery.webhookId);
			if (!webhook?.isActive) {
				log.warn("skipping delivery — webhook inactive or missing", {
					webhookId: delivery.webhookId,
				});
				failed++;
				// Terminal state: leaving it in "processing" would let
				// recoverStaleDeliveries recycle it into an endless retry loop.
				await updateDeliveryStatus(delivery.id, {
					status: "failed",
					responseBody: "webhook inactive or deleted",
					attempt: delivery.attempt,
					nextRetryAt: null,
				});
				continue;
			}

			const payload = delivery.payload;
			if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
				log.warn("invalid payload, skipping", {
					deliveryId: delivery.id,
				});
				failed++;
				await updateDeliveryStatus(delivery.id, {
					status: "failed",
					responseBody: "invalid delivery payload",
					attempt: delivery.attempt,
					nextRetryAt: null,
				});
				continue;
			}

			const event = {
				id: delivery.eventId,
				type: delivery.eventType,
				// Prisma stores JSON as Prisma.JsonValue; narrow to the event shape
				// expected by deliverWebhook.
				payload: payload as Record<string, unknown>,
			};

			const result = await deliverWebhook(webhook, event);

			if (result.success) {
				succeeded++;
				await updateDeliveryStatus(delivery.id, {
					status: "success",
					responseCode: result.responseCode,
					responseBody: result.responseBody,
					attempt: delivery.attempt,
					nextRetryAt: null,
				});
			} else {
				failed++;
				const attempt = delivery.attempt + 1;
				const shouldRetry = attempt <= webhooksConfig.maxRetries;
				await updateDeliveryStatus(delivery.id, {
					status: shouldRetry ? "retrying" : "failed",
					responseCode: result.responseCode,
					// Fall back to the transport error so DNS/timeout/network
					// failures still leave a visible failure reason on the row.
					responseBody: result.responseBody ?? result.error,
					attempt,
					nextRetryAt: shouldRetry ? calculateNextRetry(attempt) : null,
				});
			}
		} catch (err) {
			failed++;
			log.error("delivery processing error", {
				deliveryId: delivery.id,
				err: err instanceof Error ? err.message : String(err),
			});
		}
	}

	return { processed: deliveries.length, succeeded, failed };
}
