import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { webhooksConfig } from "./config";
import { signPayloadWithTimestamp } from "./sign";
import type {
	WebhookDeliveryResult,
	WebhookEndpoint,
	WebhookEvent,
} from "./types";

const log = createLogger({ scope: "webhooks:deliver" });

/**
 * Validate a webhook URL to prevent SSRF attacks.
 *
 * In production, URLs must use HTTPS. Private/reserved IP ranges and
 * loopback addresses are always blocked. In development, HTTP is allowed
 * for local testing.
 */
function validateWebhookUrl(url: string): { valid: boolean; reason?: string } {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return { valid: false, reason: "malformed URL" };
	}

	const isDev = env.NODE_ENV === "development";
	if (!isDev && parsed.protocol !== "https:") {
		return { valid: false, reason: "must use HTTPS in production" };
	}
	if (isDev && parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		return { valid: false, reason: "must use HTTP or HTTPS" };
	}

	// Normalize hostname: strip IPv6 brackets, convert IPv4-mapped IPv6
	// (e.g. ::ffff:7f00:1 → 127.0.0.1) so private-range checks see the
	// embedded IPv4 instead of bypassing both IPv4 and IPv6 checks.
	// Node's URL parser normalizes [::ffff:127.0.0.1] to [::ffff:7f00:1]
	// (hex), but we handle both dotted-decimal and hex forms for robustness.
	let host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
	const mapped = host.match(/^::ffff:(.+)$/);
	if (mapped?.[1]) {
		const rest = mapped[1];
		const dotted = rest.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
		if (dotted?.[1]) {
			host = dotted[1];
		} else {
			const hex = rest.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
			if (hex?.[1] && hex?.[2]) {
				const g1 = Number.parseInt(hex[1], 16);
				const g2 = Number.parseInt(hex[2], 16);
				host = `${(g1 >> 8) & 0xff}.${g1 & 0xff}.${(g2 >> 8) & 0xff}.${g2 & 0xff}`;
			}
		}
	}

	// Block IPv4 private/reserved ranges
	if (isPrivateIPv4(host)) {
		return { valid: false, reason: "private/reserved IP range blocked" };
	}

	// Block IPv6 private/loopback
	if (isPrivateIPv6(host)) {
		return { valid: false, reason: "private/reserved IP range blocked" };
	}

	return { valid: true };
}

function isPrivateIPv4(host: string): boolean {
	const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!match) return false;
	const [a, b] = [Number(match[1]), Number(match[2])];
	if (a === 10) return true;
	if (a === 172 && b >= 16 && b <= 31) return true;
	if (a === 192 && b === 168) return true;
	if (a === 169 && b === 254) return true;
	if (a === 127) return true;
	if (a === 0) return true;
	if (a === 100 && b >= 64 && b <= 127) return true;
	return false;
}

function isPrivateIPv6(host: string): boolean {
	const h = host.toLowerCase();
	if (h === "::1") return true;
	if (h.startsWith("fc") || h.startsWith("fd")) return true;
	if (h.startsWith("fe80:")) return true;
	return false;
}

/**
 * Deliver a webhook event to an endpoint via HTTP POST.
 *
 * Sends the JSON payload with `X-Fuutu-Signature` (t=<timestamp>,v1=<hmac>),
 * `X-Fuutu-Timestamp`, and `X-Fuutu-Event` (event type) headers.
 * Uses AbortController for timeout. Validates the target URL to prevent SSRF.
 */
export async function deliverWebhook(
	webhook: WebhookEndpoint,
	event: WebhookEvent,
): Promise<WebhookDeliveryResult> {
	const validation = validateWebhookUrl(webhook.url);
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
		});
		const responseBody = await res.text();
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
