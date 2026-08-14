import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { Polar } from "@polar-sh/sdk";
import {
	validateEvent,
	WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import type {
	CheckoutInput,
	CustomerInput,
	PortalInput,
	ProviderEvent,
	ProviderEventType,
	SeatAwarePaymentProvider,
	SetSeatsInput,
} from "../types";

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

function mapPolarEventToProviderEvent(
	polarEventType: string,
): ProviderEventType {
	switch (polarEventType) {
		case "checkout.completed":
			return "checkout.completed";
		case "subscription.created":
			return "subscription.activated";
		case "subscription.updated":
			return "subscription.updated";
		case "subscription.canceled":
			return "subscription.canceled";
		case "subscription.revoked":
			return "subscription.expired";
		default:
			log.warn("unknown polar event type", { polarEventType });
			return "subscription.updated";
	}
}

export const polarPaymentProvider: SeatAwarePaymentProvider = {
	id: "polar",
	ownsSeatSync: false,

	async createCheckoutLink(input: CheckoutInput) {
		const client = getClient();
		const checkout = await client.checkouts.create({
			products: [input.priceId],
			successUrl: input.successUrl ?? env.POLAR_SUCCESS_URL,
			externalCustomerId: input.userId ?? input.organizationId,
		});
		return { url: checkout.url };
	},

	async createCustomerPortalLink(input: PortalInput) {
		const client = getClient();
		const session = await client.customerSessions.create({
			customerId: input.customerId,
		});
		return { url: session.customerPortalUrl };
	},

	async createCustomer(input: CustomerInput) {
		const client = getClient();
		const customer = await client.customers.create({
			externalId: input.userId,
			email: input.email,
			name: input.name,
		});
		return { customerId: customer.id };
	},

	async parseWebhook(request: Request): Promise<ProviderEvent[]> {
		if (!env.POLAR_WEBHOOK_SECRET) {
			throw new Error("POLAR_WEBHOOK_SECRET is not configured");
		}

		const body = await request.text();
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		try {
			const event = validateEvent(body, headers, env.POLAR_WEBHOOK_SECRET);
			const eventType = mapPolarEventToProviderEvent(event.type);
			const providerEvent: ProviderEvent = {
				type: eventType,
				metadata: event.data as Record<string, unknown>,
			};

			const data = event.data as Record<string, unknown>;
			if (data.subscription_id) {
				providerEvent.subscriptionId = data.subscription_id as string;
			}
			if (data.customer_id) {
				providerEvent.customerId = data.customer_id as string;
			}
			if (data.product_id) {
				providerEvent.productId = data.product_id as string;
			}

			return [providerEvent];
		} catch (err) {
			if (err instanceof WebhookVerificationError) {
				throw new Error(`signature: ${err.message}`);
			}
			throw err;
		}
	},

	async cancelSubscription(subscriptionId: string) {
		const client = getClient();
		await client.subscriptions.revoke({ id: subscriptionId });
		log.info("cancelled subscription", { subscriptionId });
	},

	async setSubscriptionSeats({ subscriptionId, seats }: SetSeatsInput) {
		log.debug(
			"setSubscriptionSeats no-op: Polar manages seats via dashboard configuration, not API",
			{ subscriptionId, seats },
		);
	},
};
