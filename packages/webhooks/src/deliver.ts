import { createLogger } from "@fuutu/logs";
import { webhooksConfig } from "./config";
import { signPayloadWithTimestamp } from "./sign";
import type {
	WebhookDeliveryResult,
	WebhookEndpoint,
	WebhookEvent,
} from "./types";
import { validateWebhookUrl } from "./validate-url";

const log = createLogger({ scope: "webhooks:deliver" });

/**
 * Read a response body with a hard byte cap — `res.text()` would buffer the
 * full body before truncating, leaving worker memory unbounded. The reader
 * cancels the stream as soon as the cap is hit.
 */
async function readCappedBody(
	res: Response,
	maxBytes: number,
): Promise<string> {
	if (!res.body) return "";
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done || !value) break;
			const remaining = maxBytes - total;
			if (value.length <= remaining) {
				chunks.push(value);
				total += value.length;
			} else {
				chunks.push(value.subarray(0, remaining));
				total += remaining;
				break;
			}
		}
	} finally {
		await reader.cancel().catch(() => undefined);
	}
	return new TextDecoder().decode(
		chunks.length === 1 ? chunks[0] : Buffer.concat(chunks),
	);
}

/**
 * Deliver a webhook event to an endpoint via HTTP POST.
 *
 * Sends the JSON payload with `X-Fuutu-Signature` (t=<timestamp>,v1=<hmac>),
 * `X-Fuutu-Timestamp`, and `X-Fuutu-Event` (event type) headers.
 * Uses AbortController for timeout. Validates the target URL — including DNS
 * resolution — to prevent SSRF, and refuses redirects so a validated public
 * endpoint can't bounce the request to an internal address.
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

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), webhooksConfig.timeoutMs);

	try {
		const res = await fetch(webhook.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Fuutu-Signature": signature,
				"X-Fuutu-Timestamp": String(timestamp),
				"X-Fuutu-Event": event.type,
			},
			body,
			signal: controller.signal,
			// Webhooks must never follow redirects — a validated public URL
			// could otherwise 302 to an internal address (SSRF).
			redirect: "error",
		});
		const responseBody = await readCappedBody(
			res,
			webhooksConfig.maxResponseBodyBytes,
		);
		return {
			success: res.ok,
			responseCode: res.status,
			responseBody,
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
	} finally {
		clearTimeout(timer);
	}
}
