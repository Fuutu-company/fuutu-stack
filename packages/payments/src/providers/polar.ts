import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { Polar } from "@polar-sh/sdk";
import {
	validateEvent,
	WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
import { z } from "zod";
import type {
	CheckoutInput,
	CustomerInput,
	PaymentProvider,
	PortalInput,
	ProviderEvent,
	ProviderEventType,
} from "../types";

const log = createLogger({ scope: "payments:polar" });

/**
 * Subset of the Polar webhook `data` object we actually consume.
 * `validateEvent` already verified the signature, but its return type is a
 * broad union — validate the fields we read instead of casting.
 * user_id / organization_id live in `data.metadata` (set at checkout
 * creation), not on the event object itself.
 */
const PolarEventDataSchema = z
	.looseObject({
		id: z.string().optional(),
		subscription_id: z.string().optional(),
		customer_id: z.string().optional(),
		product_id: z.string().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.optional();

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
): ProviderEventType | null {
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
			// Unmapped Polar events (order.paid, customer.created, …) are
			// ignored — coercing them to subscription.updated would feed
			// unrelated payloads into the purchase sync.
			return null;
	}
}

export const polarPaymentProvider: PaymentProvider = {
	id: "polar",
	ownsSeatSync: false,

	async createCheckoutLink(input: CheckoutInput) {
		const client = getClient();
		// Without metadata, Polar webhook payloads carry no owner — the
		// owner-XOR rule in sync.ts would skip them as ownerless.
		const metadata: Record<string, string> = {};
		if (input.userId) metadata.user_id = input.userId;
		if (input.organizationId) metadata.organization_id = input.organizationId;
		for (const [key, value] of Object.entries(input.metadata ?? {})) {
			if (value === undefined || value === null) continue;
			metadata[key] = String(value);
		}
		const checkout = await client.checkouts.create({
			products: [input.priceId],
			successUrl: input.successUrl ?? env.POLAR_SUCCESS_URL,
			externalCustomerId: input.userId ?? input.organizationId,
			metadata,
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
			if (!eventType) {
				log.debug("ignoring unmapped polar event type", {
					polarEventType: event.type,
				});
				return [];
			}

			const parsed = PolarEventDataSchema.safeParse(event.data);
			if (!parsed.success) {
				throw new Error("Malformed webhook payload");
			}
			const data = parsed.data;
			const providerEvent: ProviderEvent = {
				type: eventType,
				// Standard-webhooks delivery id — dedup marker for
				// checkout.completed redeliveries. Falls back to the
				// payload id (checkout/order id) when the header is absent.
				eventId: headers["webhook-id"] || data?.id || undefined,
				metadata: data?.metadata,
			};

			if (data?.subscription_id) {
				providerEvent.subscriptionId = data.subscription_id;
			}
			if (data?.customer_id) {
				providerEvent.customerId = data.customer_id;
			}
			if (data?.product_id) {
				providerEvent.productId = data.product_id;
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
};
