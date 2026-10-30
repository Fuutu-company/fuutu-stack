import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import Stripe from "stripe";
import type {
	CheckoutInput,
	CustomerInput,
	PortalInput,
	ProviderEvent,
	ProviderInvoiceData,
	PurchaseStatusLiteral,
	SeatAwarePaymentProvider,
	SetSeatsInput,
} from "../types";
import { WebhookConfigError, WebhookSignatureError } from "../types";

const log = createLogger({ scope: "payments:stripe" });

let _client: Stripe | null = null;

function getClient(): Stripe {
	if (_client) return _client;
	if (!env.STRIPE_SECRET_KEY) {
		throw new WebhookConfigError(
			"[payments:stripe] STRIPE_SECRET_KEY is not set. Configure it in @fuutu/env/saas before using Stripe-backed flows.",
		);
	}
	_client = new Stripe(env.STRIPE_SECRET_KEY);
	return _client;
}

/**
 * Stripe requires absolute URLs. Env fallbacks are optional, so a
 * resolved value can be undefined — and a caller-supplied value can be
 * relative. Fail fast with a config error instead of letting the Stripe
 * API reject the request with a less actionable error.
 */
function requireAbsoluteUrl(
	url: string | null | undefined,
	what: string,
): string {
	if (!url) {
		throw new WebhookConfigError(
			`[payments:stripe] ${what} is not configured — pass it on the input or set NEXT_PUBLIC_SAAS_URL.`,
		);
	}
	if (!/^https?:\/\//.test(url)) {
		throw new WebhookConfigError(
			`[payments:stripe] ${what} must be an absolute http(s) URL, got "${url}".`,
		);
	}
	return url;
}

function mapStripeStatusToPurchaseStatus(
	status: string,
): PurchaseStatusLiteral {
	switch (status) {
		case "active":
			return "ACTIVE";
		case "trialing":
			return "TRIALING";
		case "past_due":
		case "unpaid":
			return "PAST_DUE";
		case "canceled":
			return "CANCELED";
		case "incomplete":
			return "INCOMPLETE";
		default:
			return "INCOMPLETE";
	}
}

/**
 * Extract the invoice fields the sync layer persists from a Stripe
 * Invoice object. Returns undefined when the payload has no id — without
 * a provider invoice id there is no dedup key and every redelivery would
 * create a row.
 */
function toProviderInvoice(
	invoice: Stripe.Invoice,
	amountCents: number | null | undefined,
): ProviderInvoiceData | undefined {
	if (!invoice.id) return undefined;
	// Stripe "draft" invoices are internal pre-finalization states — map
	// everything that isn't a final status to "open".
	const status =
		invoice.status === "paid" ||
		invoice.status === "void" ||
		invoice.status === "uncollectible"
			? invoice.status
			: "open";
	return {
		id: invoice.id,
		url: invoice.hosted_invoice_url ?? undefined,
		pdfUrl: invoice.invoice_pdf ?? undefined,
		amount: ((amountCents ?? 0) / 100).toFixed(2),
		currency: invoice.currency?.toUpperCase(),
		status,
		issuedAt: invoice.created ? new Date(invoice.created * 1000) : undefined,
		paidAt: invoice.status_transitions?.paid_at
			? new Date(invoice.status_transitions.paid_at * 1000)
			: undefined,
	};
}

async function parseStripeEvent(event: Stripe.Event): Promise<ProviderEvent[]> {
	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as Stripe.Checkout.Session;
			const subscriptionId =
				typeof session.subscription === "string"
					? session.subscription
					: (session.subscription?.id ?? null);
			if (subscriptionId) {
				// Subscription checkout — pass through so subscription.created
				// handler picks it up. But we attach the session metadata so
				// the sync layer can extract user_id / organization_id.
				return [
					{
						type: "checkout.completed",
						eventId: event.id,
						subscriptionId,
						customerId:
							typeof session.customer === "string"
								? session.customer
								: session.customer?.id,
						metadata: session.metadata ?? undefined,
					},
				];
			}
			// One-time payment — the session payload carries no productId, so
			// resolve the purchased price via the session's line items. A
			// Stripe API error propagates → non-2xx → Stripe retries.
			const client = getClient();
			const lineItems = await client.checkout.sessions.listLineItems(
				session.id,
				{ limit: 1 },
			);
			const productId = lineItems.data[0]?.price?.id ?? undefined;
			return [
				{
					type: "checkout.completed",
					eventId: event.id,
					customerId:
						typeof session.customer === "string"
							? session.customer
							: session.customer?.id,
					productId,
					metadata: session.metadata ?? undefined,
				},
			];
		}

		case "customer.subscription.created": {
			const subscription = event.data.object as Stripe.Subscription;
			return [
				{
					type: "subscription.activated",
					eventId: event.id,
					subscriptionId: subscription.id,
					customerId: subscription.customer as string,
					productId: subscription.items.data[0]?.price.id,
					status: mapStripeStatusToPurchaseStatus(subscription.status),
					currentPeriodEnd: subscription.items.data[0]?.current_period_end
						? new Date(subscription.items.data[0].current_period_end * 1000)
						: undefined,
					metadata: subscription.metadata,
				},
			];
		}

		case "customer.subscription.updated": {
			const subscription = event.data.object as Stripe.Subscription;
			return [
				{
					type: "subscription.updated",
					eventId: event.id,
					subscriptionId: subscription.id,
					customerId: subscription.customer as string,
					productId: subscription.items.data[0]?.price.id,
					status: mapStripeStatusToPurchaseStatus(subscription.status),
					currentPeriodEnd: subscription.items.data[0]?.current_period_end
						? new Date(subscription.items.data[0].current_period_end * 1000)
						: undefined,
					metadata: subscription.metadata,
				},
			];
		}

		case "customer.subscription.deleted": {
			const subscription = event.data.object as Stripe.Subscription;
			return [
				{
					type: "subscription.canceled",
					eventId: event.id,
					subscriptionId: subscription.id,
					customerId: subscription.customer as string,
					status: "CANCELED",
					metadata: subscription.metadata,
				},
			];
		}

		case "invoice.paid": {
			const invoice = event.data.object as Stripe.Invoice;
			const subscriptionId =
				invoice.parent?.type === "subscription_details"
					? typeof invoice.parent.subscription_details?.subscription ===
						"string"
						? invoice.parent.subscription_details.subscription
						: invoice.parent.subscription_details?.subscription?.id
					: null;
			if (subscriptionId) {
				return [
					{
						type: "subscription.renewed",
						eventId: event.id,
						subscriptionId,
						customerId: invoice.customer as string,
						status: "ACTIVE",
						currentPeriodEnd: new Date(
							(invoice.period_end ?? invoice.period_start) * 1000,
						),
						invoice: toProviderInvoice(invoice, invoice.amount_paid),
					},
				];
			}
			return [];
		}

		case "invoice.payment_failed": {
			const invoice = event.data.object as Stripe.Invoice;
			const subscriptionId =
				invoice.parent?.type === "subscription_details"
					? typeof invoice.parent.subscription_details?.subscription ===
						"string"
						? invoice.parent.subscription_details.subscription
						: invoice.parent.subscription_details?.subscription?.id
					: null;
			if (subscriptionId) {
				return [
					{
						type: "subscription.past_due",
						eventId: event.id,
						subscriptionId,
						customerId: invoice.customer as string,
						status: "PAST_DUE",
						invoice: toProviderInvoice(invoice, invoice.amount_due),
					},
				];
			}
			return [];
		}

		default:
			return [];
	}
}

export const stripePaymentProvider: SeatAwarePaymentProvider = {
	id: "stripe",
	ownsSeatSync: false,

	async createCheckoutLink(input: CheckoutInput) {
		const client = getClient();
		const mode: "subscription" | "payment" =
			input.metadata?.mode === "payment" ? "payment" : "subscription";
		// Stripe metadata values must be strings; `mode` is a control key
		// consumed here, not forwarded to Stripe.
		const metadata: Record<string, string> = {};
		for (const [key, value] of Object.entries(input.metadata ?? {})) {
			if (key === "mode" || value === undefined || value === null) continue;
			metadata[key] = String(value);
		}
		// Owner keys after the caller metadata — they must win collisions so
		// the signed webhook can't be pointed at a different billing owner.
		if (input.userId) metadata.user_id = input.userId;
		if (input.organizationId) metadata.organization_id = input.organizationId;
		const sessionParams: Stripe.Checkout.SessionCreateParams = {
			mode,
			line_items: [{ price: input.priceId, quantity: input.seats ?? 1 }],
			// Stripe requires absolute URLs — fall back to the app URL like
			// Polar does, never to a relative "/".
			success_url: requireAbsoluteUrl(
				input.successUrl ?? env.NEXT_PUBLIC_SAAS_URL,
				"checkout success URL (input.successUrl or NEXT_PUBLIC_SAAS_URL)",
			),
			cancel_url: requireAbsoluteUrl(
				input.cancelUrl ?? env.NEXT_PUBLIC_SAAS_URL,
				"checkout cancel URL (input.cancelUrl or NEXT_PUBLIC_SAAS_URL)",
			),
			customer_email: input.customerEmail,
			metadata,
		};
		// For subscriptions, also set metadata on the subscription itself
		// so webhook events carry user_id / organization_id.
		if (mode === "subscription") {
			sessionParams.subscription_data = { metadata };
		}
		const session = await client.checkout.sessions.create(sessionParams);
		if (!session.url) {
			throw new Error("Stripe checkout session created without URL");
		}
		return { url: session.url };
	},

	async createCustomerPortalLink(input: PortalInput) {
		const client = getClient();
		const session = await client.billingPortal.sessions.create({
			customer: input.customerId,
			return_url: requireAbsoluteUrl(
				input.returnUrl ?? env.NEXT_PUBLIC_SAAS_URL,
				"portal return URL (input.returnUrl or NEXT_PUBLIC_SAAS_URL)",
			),
		});
		return { url: session.url };
	},

	async createCustomer(input: CustomerInput) {
		const client = getClient();
		const customer = await client.customers.create({
			email: input.email,
			name: input.name,
			metadata: {
				...input.metadata,
				fuutu_user_id: input.userId,
			},
		});
		return { customerId: customer.id };
	},

	async cancelSubscription(subscriptionId: string) {
		const client = getClient();
		await client.subscriptions.cancel(subscriptionId);
		log.info("cancelled subscription", { subscriptionId });
	},

	async parseWebhook(request: Request): Promise<ProviderEvent[]> {
		if (!env.STRIPE_WEBHOOK_SECRET) {
			log.error("STRIPE_WEBHOOK_SECRET missing — rejecting webhook");
			throw new WebhookConfigError("webhook not configured");
		}

		const body = await request.text();
		const signature = request.headers.get("stripe-signature");
		if (!signature) {
			throw new WebhookSignatureError("signature");
		}

		try {
			const client = getClient();
			const event = await client.webhooks.constructEventAsync(
				body,
				signature,
				env.STRIPE_WEBHOOK_SECRET,
			);
			log.info("stripe webhook verified", { type: event.type });
			return await parseStripeEvent(event);
		} catch (err) {
			// Classify by the SDK's typed error, not by message substring —
			// any error mentioning "signature" would otherwise map to 401.
			if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
				log.warn("stripe webhook signature invalid", { err: err.message });
				throw new WebhookSignatureError(`signature: ${err.message}`);
			}
			log.error("stripe webhook handler failed", { err: String(err) });
			throw err;
		}
	},

	async setSubscriptionSeats({ subscriptionId, seats }: SetSeatsInput) {
		const client = getClient();
		const subscription = await client.subscriptions.retrieve(subscriptionId);
		const firstItem = subscription.items.data[0];
		if (!firstItem) {
			throw new Error(
				`Subscription ${subscriptionId} has no items to update seats`,
			);
		}
		await client.subscriptions.update(subscriptionId, {
			items: [{ id: firstItem.id, quantity: seats }],
		});
		log.info("updated subscription seats", { subscriptionId, seats });
	},
};
