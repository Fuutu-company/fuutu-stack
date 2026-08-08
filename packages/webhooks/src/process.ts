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
 */
export async function processPendingDeliveries(): Promise<{
	processed: number;
	succeeded: number;
	failed: number;
}> {
	await recoverStaleDeliveries(webhooksConfig.staleProcessingTimeoutMs);
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
				continue;
			}

			const payload = delivery.payload;
			if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
				log.warn("invalid payload, skipping", {
					deliveryId: delivery.id,
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
					responseBody: result.responseBody,
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
