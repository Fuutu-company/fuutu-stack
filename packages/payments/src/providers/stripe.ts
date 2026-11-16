import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import Stripe from "stripe";
import type {
	CancelSubscriptionOptions,
	CheckoutInput,
	CustomerInput,
	PortalInput,
	ProviderEvent,
	ProviderInvoiceData,
	PurchaseStatusLiteral,
	SeatAwarePaymentProvider,
	SeatProration,
	SetSeatsInput,
} from "../types";
import {
	failureKindForStatus,
	ProviderRequestError,
	resolveCancelMode,
	WebhookConfigError,
	WebhookSignatureError,
} from "../types";

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

/** Stripe's message for a change a canceled subscription refuses. */
const CANCELED_SUBSCRIPTION = /\bcancel(l)?ed subscription\b/i;

/**
 * A Stripe SDK error as a typed payments error: a rejected key (401/403)
 * is our configuration, a connection / API / rate-limit error
 * `unavailable`, `resource_missing` `not_found`, a change a canceled
 * subscription refuses `invalid_state`, anything else by its status.
 * Stripe's message goes to the log only. Errors not from Stripe pass
 * through unchanged.
 */
function stripeFailure(err: unknown, failure: string): unknown {
	if (!(err instanceof Stripe.errors.StripeError)) return err;
	const { statusCode: status, code, message } = err;
	log.error(failure, { status, code, type: err.type, err: message });
	if (
		err instanceof Stripe.errors.StripeAuthenticationError ||
		err instanceof Stripe.errors.StripePermissionError
	) {
		return new WebhookConfigError(
			`[payments:stripe] ${failure}: Stripe rejected the API key (HTTP ${status}). Check STRIPE_SECRET_KEY.`,
		);
	}
	const kind =
		err instanceof Stripe.errors.StripeConnectionError ||
		err instanceof Stripe.errors.StripeAPIError ||
		err instanceof Stripe.errors.StripeRateLimitError
			? "unavailable"
			: code === "resource_missing"
				? "not_found"
				: CANCELED_SUBSCRIPTION.test(message)
					? "invalid_state"
					: failureKindForStatus(status);
	return new ProviderRequestError(failure, kind, {
		status,
		detail: message,
		cause: err,
	});
}

/** Run one Stripe API call; its failure becomes a typed payments error. */
async function stripeCall<T>(
	failure: string,
	run: (client: Stripe) => Promise<T>,
): Promise<T> {
	const client = getClient();
	try {
		return await run(client);
	} catch (err) {
		throw stripeFailure(err, failure);
	}
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
		case "incomplete_expired":
			return "EXPIRED";
		default:
			return "INCOMPLETE";
	}
}

/**
 * Status of a live subscription, with a scheduled cancel
 * (`cancel_at_period_end`, or a `cancel_at` date as the customer portal
 * sets it) reported as SCHEDULED_CANCEL instead of ACTIVE/TRIALING.
 */
function stripeSubscriptionStatus(
	subscription: Pick<
		Stripe.Subscription,
		"status" | "cancel_at_period_end" | "cancel_at"
	>,
): PurchaseStatusLiteral {
	const status = mapStripeStatusToPurchaseStatus(subscription.status);
	const scheduled =
		subscription.cancel_at_period_end === true ||
		subscription.cancel_at != null;
	return scheduled && (status === "ACTIVE" || status === "TRIALING")
		? "SCHEDULED_CANCEL"
		: status;
}

/**
 * Extract the invoice fields the sync layer persists from a Stripe
 * Invoice object. Returns undefined when the payload has no id — without
 * a provider invoice id there is no dedup key and every redelivery would
 * create a row.
 */
/** Purchased units — a positive integer or nothing (same rule as Creem/Polar). */
function toUnits(value: number | null | undefined): number | undefined {
	return typeof value === "number" && Number.isInteger(value) && value > 0
		? value
		: undefined;
}

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
		// A delayed payment method (SEPA, ACH, Bacs) completes the session
		// `unpaid`; the money arrives with async_payment_succeeded. Only a
		// paid (or free) session grants — a missing status fails closed.
		case "checkout.session.completed":
		case "checkout.session.async_payment_succeeded": {
			const session = event.data.object as Stripe.Checkout.Session;
			if (
				session.payment_status !== "paid" &&
				session.payment_status !== "no_payment_required"
			) {
				log.info("checkout session not paid yet — waiting for payment", {
					sessionId: session.id,
					paymentStatus: session.payment_status ?? null,
				});
				return [];
			}
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
			const paymentIntent = idOf(session.payment_intent);
			return [
				{
					type: "checkout.completed",
					eventId: event.id,
					// A refund or dispute names the payment intent.
					...(paymentIntent ? { paymentRef: paymentIntent } : {}),
					customerId:
						typeof session.customer === "string"
							? session.customer
							: session.customer?.id,
					productId,
					units: toUnits(lineItems.data[0]?.quantity),
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
					units: toUnits(subscription.items.data[0]?.quantity),
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
					units: toUnits(subscription.items.data[0]?.quantity),
					// A cancel scheduled for the period end must not read as ACTIVE.
					status: stripeSubscriptionStatus(subscription),
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
						currentPeriodEnd: new Date(invoicePeriodEnd(invoice) * 1000),
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

		// A full refund or a dispute takes the payment back; a partial
		// refund (goodwill, proration) does not end what it paid for.
		case "charge.refunded": {
			const charge = event.data.object as Stripe.Charge;
			if (!charge.refunded) return [];
			return reversalEvent(event.id, idOf(charge.payment_intent));
		}

		case "charge.dispute.created": {
			const dispute = event.data.object as Stripe.Dispute;
			return reversalEvent(event.id, idOf(dispute.payment_intent));
		}

		default:
			return [];
	}
}

function idOf(
	value: string | { id: string } | null | undefined,
): string | null {
	if (!value) return null;
	return typeof value === "string" ? value : value.id;
}

/**
 * `payment.reversed` for a payment intent: of the subscription its
 * invoice bills, else of the one-time purchase it paid (`paymentRef`).
 * A Stripe API error propagates → non-2xx → Stripe retries.
 */
async function reversalEvent(
	eventId: string,
	paymentIntent: string | null,
): Promise<ProviderEvent[]> {
	if (!paymentIntent) return [];
	const client = getClient();
	const payments = await client.invoicePayments.list({
		payment: { type: "payment_intent", payment_intent: paymentIntent },
		limit: 1,
	});
	const invoiceRef = payments.data[0]?.invoice;
	if (invoiceRef) {
		const invoice =
			typeof invoiceRef === "string"
				? await client.invoices.retrieve(invoiceRef)
				: invoiceRef;
		const subscriptionId =
			!("deleted" in invoice && invoice.deleted) &&
			"parent" in invoice &&
			invoice.parent?.type === "subscription_details"
				? idOf(invoice.parent.subscription_details?.subscription)
				: null;
		if (subscriptionId) {
			return [{ type: "payment.reversed", eventId, subscriptionId }];
		}
	}
	return [{ type: "payment.reversed", eventId, paymentRef: paymentIntent }];
}

/**
 * End of the period a paid invoice starts: the latest line period (the
 * subscription line covers the new period). `invoice.period_end` is the
 * end of the period just billed — the fallback when the payload has no
 * lines.
 */
function invoicePeriodEnd(invoice: Stripe.Invoice): number {
	const lineEnds = (invoice.lines?.data ?? [])
		.map((line) => line.period?.end)
		.filter((end): end is number => typeof end === "number");
	return Math.max(invoice.period_end ?? invoice.period_start, ...lineEnds);
}

const STRIPE_PRORATION = {
	"charge-immediately": "always_invoice",
	none: "none",
} as const satisfies Record<
	SeatProration,
	Stripe.SubscriptionUpdateParams.ProrationBehavior
>;

export const stripePaymentProvider: SeatAwarePaymentProvider = {
	id: "stripe",
	ownsSeatSync: false,

	async createCheckoutLink(input: CheckoutInput) {
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
			sessionParams.subscription_data = {
				metadata,
				...(input.trialDays ? { trial_period_days: input.trialDays } : {}),
			};
		}
		const session = await stripeCall("Failed to create checkout link", (c) =>
			c.checkout.sessions.create(sessionParams),
		);
		if (!session.url) {
			throw new Error("Stripe checkout session created without URL");
		}
		return { url: session.url };
	},

	async createCustomerPortalLink(input: PortalInput) {
		const returnUrl = requireAbsoluteUrl(
			input.returnUrl ?? env.NEXT_PUBLIC_SAAS_URL,
			"portal return URL (input.returnUrl or NEXT_PUBLIC_SAAS_URL)",
		);
		const session = await stripeCall(
			"Failed to create customer portal link",
			(c) =>
				c.billingPortal.sessions.create({
					customer: input.customerId,
					return_url: returnUrl,
				}),
		);
		return { url: session.url };
	},

	async createCustomer(input: CustomerInput) {
		const customer = await stripeCall("Failed to create customer", (c) =>
			c.customers.create({
				email: input.email,
				name: input.name,
				metadata: {
					...input.metadata,
					fuutu_user_id: input.userId,
				},
			}),
		);
		return { customerId: customer.id };
	},

	async cancelSubscription(
		subscriptionId: string,
		options?: CancelSubscriptionOptions,
	) {
		if (resolveCancelMode(options) === "period_end") {
			await stripeCall("Failed to cancel subscription", (c) =>
				c.subscriptions.update(subscriptionId, {
					cancel_at_period_end: true,
				}),
			);
			log.info("scheduled subscription cancel", { subscriptionId });
			return;
		}
		await stripeCall("Failed to cancel subscription", (c) =>
			c.subscriptions.cancel(subscriptionId),
		);
		log.info("cancelled subscription", { subscriptionId });
	},

	async resumeSubscription(subscriptionId: string) {
		await stripeCall("Failed to resume subscription", (c) =>
			c.subscriptions.update(subscriptionId, {
				cancel_at_period_end: false,
			}),
		);
		log.info("resumed subscription", { subscriptionId });
	},

	async getSubscriptionStatus(subscriptionId: string) {
		const subscription = await stripeCall(
			"Failed to get subscription status",
			(c) => c.subscriptions.retrieve(subscriptionId),
		);
		return stripeSubscriptionStatus(subscription);
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

	async getSubscriptionSeats(subscriptionId: string) {
		const subscription = await stripeCall("Failed to get subscription", (c) =>
			c.subscriptions.retrieve(subscriptionId),
		);
		// Licensed prices always carry a quantity (default 1); a metered
		// price has none and cannot count seats.
		const quantity = subscription.items.data[0]?.quantity;
		if (quantity == null || quantity < 1) {
			throw new Error(`Subscription ${subscriptionId} has no seat quantity`);
		}
		return quantity;
	},

	async setSubscriptionSeats({
		subscriptionId,
		seats,
		proration,
	}: SetSeatsInput) {
		const subscription = await stripeCall("Failed to get subscription", (c) =>
			c.subscriptions.retrieve(subscriptionId),
		);
		const firstItem = subscription.items.data[0];
		if (!firstItem) {
			throw new Error(
				`Subscription ${subscriptionId} has no items to update seats`,
			);
		}
		await stripeCall("Failed to update subscription seats", (c) =>
			c.subscriptions.update(subscriptionId, {
				items: [{ id: firstItem.id, quantity: seats }],
				// Omitted: the account default (create_prorations).
				...(proration && {
					proration_behavior: STRIPE_PRORATION[proration],
				}),
			}),
		);
		log.info("updated subscription seats", { subscriptionId, seats });
	},
};
