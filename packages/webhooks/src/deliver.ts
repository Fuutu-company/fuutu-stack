import { KIT_NAME, KIT_VERSION } from "@fuutu/config";
import { createLogger } from "@fuutu/logs";
import { webhooksConfig } from "./config";
import { pinnedPost } from "./pinned-post";
import { signPayloadWithTimestamp } from "./sign";
import type {
	WebhookDeliveryResult,
	WebhookEndpoint,
	WebhookEvent,
} from "./types";
import { createPinnedLookup, validateWebhookUrl } from "./validate-url";

const log = createLogger({ scope: "webhooks:deliver" });

/**
 * Deliver a webhook event to an endpoint via HTTP POST.
 *
 * Sends the JSON payload with `X-Fuutu-Signature` (t=<timestamp>,v1=<hmac>),
 * `X-Fuutu-Timestamp`, `X-Fuutu-Event` (event type), and `X-Fuutu-Event-Id`
 * headers. The event ID is stable across retries — receivers should use it
 * as their deduplication key (delivery is at-least-once). The signature
 * covers only `timestamp.body`; the ID header is informational.
 * Validates the target URL — including DNS resolution — to prevent SSRF,
 * then connects only to an address re-checked at connect time (pinned
 * lookup, so DNS rebinding cannot swap in an internal IP), and never
 * follows redirects so a validated public endpoint can't bounce the
 * request to an internal address.
 */
export async function deliverWebhook(
	webhook: WebhookEndpoint,
	event: WebhookEvent,
): Promise<WebhookDeliveryResult> {
	const validation = await validateWebhookUrl(webhook.url);
	if (!validation.valid) {
		log.warn("skipping delivery — invalid webhook URL", {
			webhookId: webhook.id,
			reason: validation.reason,
		});
		return {
			success: false,
			responseCode: null,
			responseBody: null,
			error: `URL validation failed: ${validation.reason}`,
		};
	}

	const body = JSON.stringify(event.payload);
	const timestamp = Math.floor(Date.now() / 1000);
	const signature = signPayloadWithTimestamp(
		webhook.secret,
		event.payload,
		timestamp,
	);

	try {
		const res = await pinnedPost(new URL(webhook.url), {
			headers: {
				"Content-Type": "application/json",
				// Lets receivers identify/allowlist kit-originated deliveries.
				"User-Agent": `${KIT_NAME}-Webhook/${KIT_VERSION}`,
				"X-Fuutu-Signature": signature,
				"X-Fuutu-Timestamp": String(timestamp),
				"X-Fuutu-Event": event.type,
				"X-Fuutu-Event-Id": event.id,
			},
			body,
			lookup: createPinnedLookup(),
			timeoutMs: webhooksConfig.timeoutMs,
			maxResponseBytes: webhooksConfig.maxResponseBodyBytes,
		});
		return {
			success: res.status >= 200 && res.status < 300,
			responseCode: res.status,
			responseBody: res.body,
			error: null,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log.error("webhook delivery failed", {
			webhookId: webhook.id,
			err: message,
		});
		return {
			success: false,
			responseCode: null,
			responseBody: null,
			error: message,
		};
	}
}
