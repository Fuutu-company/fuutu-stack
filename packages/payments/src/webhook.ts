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
import { resolvePaymentProvider } from "./resolve";
import { processWebhookEvents } from "./sync";
import type { PaymentsWebhookHandler, ProviderEvent } from "./types";

const log = createLogger({ scope: "payments:webhook" });

/**
 * The shared webhook handler. Mount this at your webhook endpoint.
 * It resolves the active provider, parses the payload, and syncs to DB.
 */
export const handlePaymentsWebhook: PaymentsWebhookHandler = async (
	request: Request,
): Promise<Response> => {
	const provider = resolvePaymentProvider();

	let events: ProviderEvent[];
	try {
		events = await provider.parseWebhook(request);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		// 401 = signature verification failure, 400 = malformed payload
		const status = message.includes("signature") ? 401 : 400;
		log.warn("webhook parse failed", {
			provider: provider.id,
			status,
			err: message,
		});
		return new Response(message, { status });
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

/**
 * Resolve the active webhook handler from the configured provider.
 * Kept for backward compatibility — prefer `handlePaymentsWebhook` directly.
 */
export function getPaymentsWebhookHandler(): PaymentsWebhookHandler {
	return handlePaymentsWebhook;
}

/**
 * Default webhook handler used when no payment provider is configured.
 * Returns 501 so ops can tell "provider missing" apart from "signature invalid".
 */
export const noopPaymentsWebhookHandler: PaymentsWebhookHandler = async () =>
	new Response(
		JSON.stringify({
			error: "payments_provider_not_configured",
			message:
				"No payments provider is active. Configure `paymentsConfig.provider`.",
		}),
		{
			status: 501,
			headers: { "content-type": "application/json" },
		},
	);
