import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";
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
import { WebhookConfigError, WebhookSignatureError } from "../types";

const log = createLogger({ scope: "payments:creem" });

/**
 * Fail fast on a missing API key instead of sending an empty
 * `x-api-key` credential — Creem is a thin fetch wrapper with no
 * client object, so the check lives where the env is consumed.
 */
function getApiKey(): string {
	if (!env.CREEM_API_KEY) {
		throw new WebhookConfigError(
			"[payments:creem] CREEM_API_KEY is not set. Configure it in @fuutu/env/saas before using Creem-backed flows.",
		);
	}
	return env.CREEM_API_KEY;
}

function creemFetch(path: string, init: RequestInit = {}) {
	const baseUrl = env.CREEM_TEST_MODE
		? "https://test-api.creem.io/v1"
		: "https://api.creem.io/v1";

	const url = `${baseUrl}${path}`;

	return fetch(url, {
		...init,
		headers: {
			"x-api-key": getApiKey(),
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

const creemWebhookSchema = z.object({
	id: z.string().optional(),
	eventType: z.string(),
	object: z.object({
		id: z.string().optional(),
		customer: z
			.union([
				z.string(),
				z.object({ id: z.string(), email: z.string().optional() }),
			])
			.optional(),
		product: z.object({ id: z.string() }).optional(),
		status: z.string().optional(),
		current_period_end_date: z.string().optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		subscription: z.object({ id: z.string() }).optional(),
	}),
});

function getCustomerId(
	customer: string | { id: string; email?: string } | undefined,
): string | undefined {
	if (typeof customer === "string") {
		return customer;
	}
	return customer?.id;
}

const CreemCheckoutResponseSchema = z.object({ checkout_url: z.string() });
const CreemPortalResponseSchema = z.object({
	customer_portal_link: z.string(),
});
const CreemCustomerResponseSchema = z.object({ id: z.string() });
const CreemSubscriptionResponseSchema = z.object({
	items: z.array(z.object({ id: z.string() })).optional(),
});

const ErrorBodySchema = z.record(z.string(), z.unknown());

/** Best-effort parse of an error body for logging — never throws. */
async function readErrorBody(response: Response) {
	const parsed = ErrorBodySchema.safeParse(await response.json());
	return parsed.success ? parsed.data : { raw: "unparseable" };
}

/** Parse a Creem API response — fail closed on an unexpected shape. */
async function parseCreemResponse<T extends z.ZodType>(
	response: Response,
	schema: T,
	failure: string,
): Promise<z.infer<T>> {
	const parsed = schema.safeParse(await response.json());
	if (!parsed.success) {
		throw new Error(failure);
	}
	return parsed.data;
}

export const creemPaymentProvider: SeatAwarePaymentProvider = {
	id: "creem",
	ownsSeatSync: false,

	async createCheckoutLink(input: CheckoutInput) {
		// Note: Creem's checkout API does not accept a cancel_url parameter —
		// `input.cancelUrl` is intentionally ignored; buyers use the hosted
		// checkout page's back navigation.
		const response = await creemFetch("/checkouts", {
			method: "POST",
			body: JSON.stringify({
				product_id: input.priceId,
				units: input.seats ?? 1,
				success_url: input.successUrl,
				metadata: {
					// Owner keys last — caller metadata must not be able to
					// override the billing owner on the signed webhook.
					...input.metadata,
					organization_id: input.organizationId || null,
					user_id: input.userId || null,
				},
				customer: {
					email: input.customerEmail,
				},
			}),
		});

		if (!response.ok) {
			const error = await readErrorBody(response);
			log.error("Failed to create checkout link", error);
			throw new Error("Failed to create checkout link");
		}

		const { checkout_url } = await parseCreemResponse(
			response,
			CreemCheckoutResponseSchema,
			"Failed to create checkout link",
		);
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
			const error = await readErrorBody(response);
			log.error("Failed to create customer portal link", error);
			throw new Error("Failed to create customer portal link");
		}

		const { customer_portal_link } = await parseCreemResponse(
			response,
			CreemPortalResponseSchema,
			"Failed to create customer portal link",
		);
		return { url: customer_portal_link };
	},

	async createCustomer(input: CustomerInput) {
		const response = await creemFetch("/customers", {
			method: "POST",
			body: JSON.stringify({
				email: input.email,
				name: input.name,
				metadata: {
					...input.metadata,
					user_id: input.userId,
				},
			}),
		});

		if (!response.ok) {
			const error = await readErrorBody(response);
			log.error("Failed to create customer", error);
			throw new Error("Failed to create customer");
		}

		const { id } = await parseCreemResponse(
			response,
			CreemCustomerResponseSchema,
			"Failed to create customer",
		);
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
			const error = await readErrorBody(response);
			log.error("Failed to cancel subscription", error);
			throw new Error("Failed to cancel subscription");
		}
	},

	async parseWebhook(request: Request) {
		const signature = request.headers.get("creem-signature");

		if (!signature) {
			throw new WebhookSignatureError("Missing signature");
		}

		const bodyText = await request.text();
		const webhookSecret = env.CREEM_WEBHOOK_SECRET;
		if (!webhookSecret) {
			throw new WebhookConfigError("Missing webhook secret");
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
			throw new WebhookSignatureError("Invalid signature");
		}

		// A signed body that isn't JSON is malformed, not inauthentic —
		// surface the same error as a schema mismatch (→ 400), never a raw
		// SyntaxError.
		let bodyJson: unknown;
		try {
			bodyJson = JSON.parse(bodyText);
		} catch {
			throw new Error("Malformed webhook payload");
		}
		const parsed = creemWebhookSchema.safeParse(bodyJson);
		if (!parsed.success) {
			throw new Error("Malformed webhook payload");
		}
		const payload = parsed.data;
		const eventType = payload.eventType;
		const mappedType = mapCreemEvent(eventType);

		if (!mappedType) {
			return [];
		}

		const object = payload.object;

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
			// Event id for webhook dedup — falls back to the object id
			// (checkout session id) when Creem omits the envelope id.
			eventId: payload.id ?? object.id,
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
			const error = await readErrorBody(getResponse);
			log.error("Failed to get subscription", error);
			throw new Error("Failed to get subscription");
		}

		const { items } = await parseCreemResponse(
			getResponse,
			CreemSubscriptionResponseSchema,
			"Failed to get subscription",
		);

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
			const error = await readErrorBody(updateResponse);
			log.error("Failed to update subscription seats", error);
			throw new Error("Failed to update subscription seats");
		}
	},
};
