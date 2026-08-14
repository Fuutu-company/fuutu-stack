import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import Stripe from "stripe";
import type {
	CheckoutInput,
	CustomerInput,
	PortalInput,
	ProviderEvent,
	PurchaseStatusLiteral,
	SeatAwarePaymentProvider,
	SetSeatsInput,
} from "../types";

const log = createLogger({ scope: "payments:stripe" });

let _client: Stripe | null = null;

function getClient(): Stripe {
	if (_client) return _client;
	if (!env.STRIPE_SECRET_KEY) {
		throw new Error(
			"[payments:stripe] STRIPE_SECRET_KEY is not set. Configure it in @fuutu/env/saas before using Stripe-backed flows.",
		);
	}
	_client = new Stripe(env.STRIPE_SECRET_KEY);
	return _client;
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

async function parseStripeEvent(event: Stripe.Event): Promise<ProviderEvent[]> {
	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as Stripe.Checkout.Session;
			const subscriptionId = session.subscription as string | null;
			if (subscriptionId) {
				// Subscription checkout — pass through so subscription.created
				// handler picks it up. But we attach the session metadata so
				// the sync layer can extract user_id / organization_id.
				return [
					{
						type: "checkout.completed",
						subscriptionId,
						customerId: session.customer as string,
						metadata: session.metadata ?? undefined,
					},
				];
			}
			return [
				{
					type: "checkout.completed",
					customerId: session.customer as string,
					metadata: session.metadata ?? undefined,
				},
			];
		}

		case "customer.subscription.created": {
			const subscription = event.data.object as Stripe.Subscription;
			return [
				{
					type: "subscription.activated",
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
						subscriptionId,
						customerId: invoice.customer as string,
						status: "ACTIVE",
						currentPeriodEnd: new Date(
							(invoice.period_end ?? invoice.period_start) * 1000,
						),
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
						subscriptionId,
						customerId: invoice.customer as string,
						status: "PAST_DUE",
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
		const metadata: Record<string, string> = {};
		if (input.userId) metadata.user_id = input.userId;
		if (input.organizationId) metadata.organization_id = input.organizationId;
		const sessionParams: Stripe.Checkout.SessionCreateParams = {
			mode,
			line_items: [{ price: input.priceId, quantity: input.seats ?? 1 }],
			success_url: input.successUrl ?? "/",
			cancel_url: input.cancelUrl ?? "/",
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
			return_url: input.returnUrl ?? "/",
		});
		return { url: session.url };
	},

	async createCustomer(input: CustomerInput) {
		const client = getClient();
		const customer = await client.customers.create({
			email: input.email,
			name: input.name,
			metadata: {
				fuutu_user_id: input.userId,
				...input.metadata,
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
			throw new Error("webhook not configured");
		}

		const body = await request.text();
		const signature = request.headers.get("stripe-signature");
		if (!signature) {
			throw new Error("signature");
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
			if (err instanceof Error && err.message.includes("signature")) {
				log.warn("stripe webhook signature invalid", { err: err.message });
				throw new Error("signature");
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
