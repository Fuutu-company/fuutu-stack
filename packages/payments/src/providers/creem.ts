import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import type {
	CheckoutInput,
	CustomerInput,
	PortalInput,
	ProviderEvent,
	ProviderEventType,
	PurchaseStatusLiteral,
	SeatAwarePaymentProvider,
	SetSeatsInput,
} from "../types";

const log = createLogger({ scope: "payments:creem" });

function creemFetch(path: string, init: RequestInit = {}) {
	const baseUrl = env.CREEM_TEST_MODE
		? "https://test-api.creem.io/v1"
		: "https://api.creem.io/v1";

	const url = `${baseUrl}${path}`;

	return fetch(url, {
		...init,
		headers: {
			"x-api-key": env.CREEM_API_KEY ?? "",
			"Content-Type": "application/json",
			...init.headers,
		},
	});
}

function mapCreemStatus(status: string): PurchaseStatusLiteral {
	switch (status) {
		case "active":
			return "ACTIVE";
		case "trialing":
			return "TRIALING";
		case "past_due":
			return "PAST_DUE";
		case "scheduled_cancel":
			return "SCHEDULED_CANCEL";
		case "paused":
			return "PAUSED";
		case "canceled":
			return "CANCELED";
		case "expired":
			return "EXPIRED";
		default:
			return "INCOMPLETE";
	}
}

function mapCreemEvent(eventType: string): ProviderEventType | null {
	switch (eventType) {
		case "checkout.completed":
			return "checkout.completed";
		case "subscription.active":
			return "subscription.activated";
		case "subscription.paid":
			return "subscription.renewed";
		case "subscription.update":
			return "subscription.updated";
		case "subscription.past_due":
			return "subscription.past_due";
		case "subscription.paused":
			return "subscription.paused";
		case "subscription.scheduled_cancel":
			return "subscription.scheduled_cancel";
		case "subscription.canceled":
			return "subscription.canceled";
		case "subscription.expired":
			return "subscription.expired";
		case "subscription.trialing":
			return "subscription.activated";
		default:
			return null;
	}
}

function getCustomerId(
	customer: string | { id: string; email?: string } | undefined,
): string | undefined {
	if (typeof customer === "string") {
		return customer;
	}
	return customer?.id;
}

export const creemPaymentProvider: SeatAwarePaymentProvider = {
	id: "creem",
	ownsSeatSync: false,

	async createCheckoutLink(input: CheckoutInput) {
		const response = await creemFetch("/checkouts", {
			method: "POST",
			body: JSON.stringify({
				product_id: input.priceId,
				units: input.seats ?? 1,
				success_url: input.successUrl,
				metadata: {
					organization_id: input.organizationId || null,
					user_id: input.userId || null,
					...input.metadata,
				},
				customer: {
					email: input.customerEmail,
				},
			}),
		});

		if (!response.ok) {
			const error = (await response.json()) as Record<string, unknown>;
			log.error("Failed to create checkout link", error);
			throw new Error("Failed to create checkout link");
		}

		const { checkout_url } = (await response.json()) as {
			checkout_url: string;
		};
		return { url: checkout_url };
	},

	async createCustomerPortalLink(input: PortalInput) {
		const response = await creemFetch("/customers/billing", {
			method: "POST",
			body: JSON.stringify({
				customer_id: input.customerId,
			}),
		});

		if (!response.ok) {
			const error = (await response.json()) as Record<string, unknown>;
			log.error("Failed to create customer portal link", error);
			throw new Error("Failed to create customer portal link");
		}

		const { customer_portal_link } = (await response.json()) as {
			customer_portal_link: string;
		};
		return { url: customer_portal_link };
	},

	async createCustomer(input: CustomerInput) {
		const response = await creemFetch("/customers", {
			method: "POST",
			body: JSON.stringify({
				email: input.email,
				name: input.name,
				metadata: {
					user_id: input.userId,
					...input.metadata,
				},
			}),
		});

		if (!response.ok) {
			const error = (await response.json()) as Record<string, unknown>;
			log.error("Failed to create customer", error);
			throw new Error("Failed to create customer");
		}

		const { id } = (await response.json()) as { id: string };
		return { customerId: id };
	},

	async cancelSubscription(subscriptionId: string) {
		const response = await creemFetch(
			`/subscriptions/${subscriptionId}/cancel`,
			{
				method: "POST",
			},
		);

		if (!response.ok) {
			const error = (await response.json()) as Record<string, unknown>;
			log.error("Failed to cancel subscription", error);
			throw new Error("Failed to cancel subscription");
		}
	},

	async parseWebhook(request: Request) {
		const signature = request.headers.get("creem-signature");

		if (!signature) {
			throw new Error("Missing signature");
		}

		const bodyText = await request.text();
		const webhookSecret = env.CREEM_WEBHOOK_SECRET;
		if (!webhookSecret) {
			throw new Error("Missing webhook secret");
		}
		const computedSignature = createHmac("sha256", webhookSecret)
			.update(bodyText)
			.digest("hex");

		// Use timing-safe comparison to prevent timing attacks
		const computedBuffer = Buffer.from(computedSignature, "utf8");
		const receivedBuffer = Buffer.from(signature, "utf8");
		if (
			computedBuffer.length !== receivedBuffer.length ||
			!timingSafeEqual(computedBuffer, receivedBuffer)
		) {
			throw new Error("Invalid signature");
		}

		const payload = JSON.parse(bodyText);
		const eventType = payload.eventType as string;
		const mappedType = mapCreemEvent(eventType);

		if (!mappedType) {
			return [];
		}

		const object = payload.object as {
			id?: string;
			customer?: string | { id: string; email?: string };
			product?: { id: string };
			status?: string;
			current_period_end_date?: string;
			metadata?: Record<string, unknown>;
			subscription?: { id: string };
		};

		// Skip checkout.completed if it created a subscription (subscription events handle it)
		if (eventType === "checkout.completed" && object.subscription?.id) {
			return [];
		}

		const customerId = getCustomerId(object.customer);
		// For one-time purchases (checkout.completed without a subscription),
		// object.id is the checkout session ID, NOT a subscription ID.
		// Setting subscriptionId here would cause the sync to treat it as a
		// subscription activation, which would cancel existing subscriptions
		// and skip top-up credit granting. Only set subscriptionId for actual
		// subscription events.
		const isOneTimeCheckout =
			eventType === "checkout.completed" && !object.subscription?.id;
		const subscriptionId = isOneTimeCheckout ? undefined : object.id;
		const productId = object.product?.id;
		const status = object.status ? mapCreemStatus(object.status) : undefined;
		const currentPeriodEnd = object.current_period_end_date
			? new Date(object.current_period_end_date)
			: undefined;

		const event: ProviderEvent = {
			type: mappedType,
			subscriptionId,
			customerId,
			productId,
			status,
			currentPeriodEnd,
			metadata: object.metadata,
		};

		return [event];
	},

	async setSubscriptionSeats(input: SetSeatsInput) {
		const { subscriptionId, seats } = input;

		const getResponse = await creemFetch(
			`/subscriptions?subscription_id=${subscriptionId}`,
			{
				method: "GET",
			},
		);

		if (!getResponse.ok) {
			const error = (await getResponse.json()) as Record<string, unknown>;
			log.error("Failed to get subscription", error);
			throw new Error("Failed to get subscription");
		}

		const { items } = (await getResponse.json()) as { items: { id: string }[] };

		if (!items || items.length === 0) {
			throw new Error("No subscription items found");
		}

		const firstItem = items[0];
		if (!firstItem) {
			throw new Error("No subscription items found");
		}

		const updateResponse = await creemFetch(
			`/subscriptions/${subscriptionId}`,
			{
				method: "POST",
				body: JSON.stringify({
					items: [
						{
							id: firstItem.id,
							quantity: seats,
						},
					],
				}),
			},
		);

		if (!updateResponse.ok) {
			const error = (await updateResponse.json()) as Record<string, unknown>;
			log.error("Failed to update subscription seats", error);
			throw new Error("Failed to update subscription seats");
		}
	},
};
