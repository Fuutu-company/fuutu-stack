import { createLogger } from "@fuutu/logs";
import { resolvePaymentProvider } from "./resolve";
import type { PaymentsWebhookHandler } from "./types";

const log = createLogger({ scope: "payments:webhook" });

/**
 * Default webhook handler used when no payment provider is configured.
 * Returns 501 so ops can tell "provider missing" apart from "signature
 * invalid" (which the real provider handler would return as 401/400).
 *
 * Better-Auth's Polar plugin (`@polar-sh/better-auth`) already mounts a
 * webhook handler under `/api/auth/polar/webhooks` that handles auth-
 * linked events (checkout.completed, subscription.*, seat-sync).
 *
 * This `/api/webhooks/payments` route is the **Fuutu-owned** entry for
 * events that Better-Auth does not process — extensibility point for
 * custom business logic (credit accounting, fraud hooks, analytics,
 * domain events fanout). The active provider's non-auth handler is wired
 * here and keeps Better-Auth's auth-linked webhook intact.
 */
export const noopPaymentsWebhookHandler: PaymentsWebhookHandler = async () =>
	new Response(
		JSON.stringify({
			error: "payments_provider_not_configured",
			message:
				"No payments provider is active. Configure `config.payments.provider`.",
		}),
		{
			status: 501,
			headers: { "content-type": "application/json" },
		},
	);

/**
 * Resolve the active webhook handler from the configured provider.
 *
 * Mounts under `/api/webhooks/payments` in the SaaS app. Better-Auth's
 * own Polar webhook at `/api/auth/polar/webhooks` continues to handle
 * auth-linked events (subscriptions/seats) — this handler owns the
 * business-logic subset (refunds, analytics, fanout).
 */
export function getPaymentsWebhookHandler(): PaymentsWebhookHandler {
	try {
		return resolvePaymentProvider().webhookHandler;
	} catch (err) {
		// Fail loud: a silent fallback to 501 would mask genuine provider
		// misconfiguration in prod and make dropped webhook events untraceable.
		log.error("failed to resolve payments webhook handler", {
			err: String(err),
		});
		return noopPaymentsWebhookHandler;
	}
}
