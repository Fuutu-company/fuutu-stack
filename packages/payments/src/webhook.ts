/**
 * Shared webhook HTTP entry — provider-agnostic.
 *
 * Webhooks bypass auth context: provider signs requests, no session needed.
 * This handler is mounted before auth middleware in the API layer.
 *
 * Mounted at `/api/webhooks/payments` in the SaaS app. This handler:
 *   1. Resolves the active provider
 *   2. Calls `provider.parseWebhook(request)` — provider verifies signature + parses
 *   3. Feeds the normalized `ProviderEvent[]` to `processWebhookEvents()`
 *   4. Returns 200 to acknowledge receipt
 *
 * Providers do NOT write to the database in `parseWebhook` — that's
 * `processWebhookEvents`'s job. This separation keeps the HTTP layer
 * thin and the business logic testable without HTTP mocks.
 */

import { createLogger } from "@fuutu/logs";
import { isPaymentsEnabled, paymentsConfig } from "./config";
import { resolvePaymentProvider } from "./resolve";
import { processWebhookEvents } from "./sync";
import {
	type PaymentProvider,
	PaymentsDisabledError,
	type PaymentsWebhookHandler,
	type ProviderEvent,
	WebhookConfigError,
	WebhookSignatureError,
} from "./types";

const log = createLogger({ scope: "payments:webhook" });

/**
 * The shared webhook handler. Mount this at your webhook endpoint.
 * It resolves the active provider, parses the payload, and syncs to DB.
 */
export const handlePaymentsWebhook: PaymentsWebhookHandler = async (
	request: Request,
): Promise<Response> => {
	if (!isPaymentsEnabled()) {
		return new Response("payments disabled", { status: 501 });
	}

	// Resolution lives inside the try so a provider-misconfig throw
	// (WebhookConfigError from resolve.ts) lands in the status mapping
	// below instead of escaping as an unhandled 500 with no body.
	let providerId: string = paymentsConfig.provider;
	let provider: PaymentProvider;
	let events: ProviderEvent[];
	try {
		provider = resolvePaymentProvider();
		providerId = provider.id;
		events = await provider.parseWebhook(request);
	} catch (err) {
		// Status is mapped by error type, never by message content:
		//   WebhookSignatureError → 401 (inauthentic delivery)
		//   WebhookConfigError    → 500 (our misconfig — provider should retry)
		//   PaymentsDisabledError → 501 (provider skeleton / payments off)
		//   anything else         → 400 (malformed payload)
		const status =
			err instanceof WebhookSignatureError
				? 401
				: err instanceof WebhookConfigError
					? 500
					: err instanceof PaymentsDisabledError
						? 501
						: 400;
		log.warn("webhook parse failed", {
			provider: providerId,
			status,
			err: err instanceof Error ? err.message : String(err),
		});
		// Generic body — the raw provider error may leak internals.
		const body =
			status === 401
				? "invalid signature"
				: status === 500
					? "webhook misconfigured"
					: status === 501
						? "payments disabled"
						: "malformed payload";
		return new Response(body, { status });
	}

	if (events.length === 0) {
		// Provider parsed successfully but found no relevant events
		return new Response(null, { status: 200 });
	}

	try {
		await processWebhookEvents(provider.id, events);
	} catch (err) {
		log.error("webhook sync failed", {
			provider: provider.id,
			err: String(err),
		});
		// 500 so the provider retries — we may have partially processed
		return new Response("internal error", { status: 500 });
	}

	return new Response(null, { status: 200 });
};
