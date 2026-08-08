import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { Polar } from "@polar-sh/sdk";
import {
	validateEvent,
	WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import type {
	CheckoutLinkInput,
	CustomerPortalInput,
	PaymentProvider,
	SetSeatsInput,
} from "../types";

/**
 * Polar payment provider (v1 active).
 *
 * Division of responsibilities with Better-Auth's Polar plugin
 * (`@polar-sh/better-auth`):
 *   - **Better-Auth** owns `/api/auth/polar/webhooks` and handles
 *     auth-linked events: checkout.completed, subscription.created/
 *     updated/canceled, customer.* — it verifies the signature itself
 *     and updates the DB. We do not touch those.
 *   - **This provider** owns the Fuutu-side entry for events BA does
 *     not process (refunds, analytics, custom metadata fanout). We
 *     verify the signature ourselves because BA never sees these.
 *
 * Seat accounting is a Fuutu concern (BA's plugin does not sync org
 * seats on member add/remove), so we expose a dedicated method and
 * delegate the actual SDK call to the active Polar API surface.
 */
const log = createLogger({ scope: "payments:polar" });

let _client: Polar | null = null;

/**
 * Lazy-init the Polar SDK client. Avoids throwing at module load when the
 * access token is absent in dev — callers trigger the real check on use.
 */
function getClient(): Polar {
	if (_client) return _client;
	if (!env.POLAR_ACCESS_TOKEN) {
		throw new Error(
			"[payments:polar] POLAR_ACCESS_TOKEN is not set. Configure it in @fuutu/env/saas before using Polar-backed flows.",
		);
	}
	_client = new Polar({
		accessToken: env.POLAR_ACCESS_TOKEN,
		server: env.NODE_ENV === "production" ? "production" : "sandbox",
	});
	return _client;
}

export const polarPaymentProvider: PaymentProvider = {
	id: "polar",

	async createCheckoutLink(input: CheckoutLinkInput) {
		const client = getClient();
		const checkout = await client.checkouts.create({
			products: [input.priceId],
			successUrl: input.successUrl ?? env.POLAR_SUCCESS_URL,
			externalCustomerId: input.userId ?? input.organizationId,
		});
		return { url: checkout.url };
	},

	async createCustomerPortalLink(input: CustomerPortalInput) {
		const client = getClient();
		const session = await client.customerSessions.create({
			customerId: input.customerId,
		});
		return { url: session.customerPortalUrl };
	},

	/**
	 * Fuutu-owned webhook entry (mounted at `/api/webhooks/payments`).
	 *
	 * Complementary to Better-Auth's own Polar webhook (see the comment
	 * block at the top of this file). Signature is verified via the
	 * official `@polar-sh/sdk/webhooks` helper using
	 * `POLAR_WEBHOOK_SECRET` — a separate secret from the one BA uses.
	 *
	 * Concrete per-event business handlers are added feature-by-feature;
	 * for now we validate, log, and ack with 200.
	 */
	webhookHandler: async (request: Request) => {
		if (!env.POLAR_WEBHOOK_SECRET) {
			// 503 (not 500) so Polar's retry queue treats this as a
			// transient "not configured yet" condition instead of a
			// permanent application bug.
			log.error("POLAR_WEBHOOK_SECRET missing — rejecting webhook");
			return new Response("webhook not configured", { status: 503 });
		}

		const body = await request.text();
		// Collect headers into a plain object — `validateEvent` expects
		// a `Record<string, string>` shape across Node 18+ / Edge runtimes.
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		try {
			const event = validateEvent(body, headers, env.POLAR_WEBHOOK_SECRET);
			log.info("polar webhook verified", { type: event.type });
			// Per-event dispatch happens here as concrete features land;
			// the ack keeps Polar's retry queue clean in the meantime.
			return new Response(null, { status: 200 });
		} catch (err) {
			if (err instanceof WebhookVerificationError) {
				log.warn("polar webhook signature invalid", { err: err.message });
				return new Response("invalid signature", { status: 401 });
			}
			log.error("polar webhook handler failed", { err: String(err) });
			return new Response("internal error", { status: 500 });
		}
	},

	async cancelSubscription(subscriptionId: string) {
		const client = getClient();
		await client.subscriptions.revoke({ id: subscriptionId });
		log.info("cancelled subscription", { subscriptionId });
	},

	/**
	 * Polar: seat-sync is owned by the Better-Auth Polar plugin, which
	 * reacts to organization membership changes and updates the seat
	 * count on the underlying subscription product. We intentionally
	 * do NOT issue a second SDK call here — that would double-count
	 * or race the plugin. The `ownsSeatSync: true` flag on the module
	 * export lets callers (auth hooks) skip the `setSubscriptionSeats`
	 * round-trip entirely when Polar is active.
	 *
	 * Kept as a typed no-op so the `PaymentProvider` contract stays
	 * uniform across providers that DO drive seats from our side
	 * (Stripe, Lemonsqueezy).
	 */
	ownsSeatSync: true,
	async setSubscriptionSeats({ subscriptionId, seats }: SetSeatsInput) {
		log.debug("setSubscriptionSeats noop (handled by BA polar plugin)", {
			subscriptionId,
			seats,
		});
	},
};
