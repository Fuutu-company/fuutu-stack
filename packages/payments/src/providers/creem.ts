import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";
import { type CreemUpdateBehavior, paymentsConfig } from "../config";
import type {
	CancelMode,
	CancelSubscriptionOptions,
	CheckoutInput,
	CustomerInput,
	PortalInput,
	ProviderEvent,
	ProviderEventType,
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

/** Upper bound for one Creem API call — a hanging API must not stall the request. */
const CREEM_TIMEOUT_MS = 10_000;

async function creemFetch(path: string, init: RequestInit = {}) {
	const baseUrl = env.CREEM_TEST_MODE
		? "https://test-api.creem.io/v1"
		: "https://api.creem.io/v1";

	const url = `${baseUrl}${path}`;
	const apiKey = getApiKey();

	try {
		return await fetch(url, {
			...init,
			signal: init.signal ?? AbortSignal.timeout(CREEM_TIMEOUT_MS),
			headers: {
				"x-api-key": apiKey,
				"Content-Type": "application/json",
				...init.headers,
			},
		});
	} catch (cause) {
		log.error("Creem could not be reached", { path, err: String(cause) });
		throw new ProviderRequestError(
			"Creem could not be reached",
			"unavailable",
			{ cause },
		);
	}
}

/**
 * Creem requires an absolute success URL. Same contract as the Stripe and
 * Polar providers — fail fast with a config error instead of letting a
 * relative or missing URL reach the Creem API.
 */
function requireAbsoluteUrl(
	url: string | null | undefined,
	what: string,
): string {
	if (!url) {
		throw new WebhookConfigError(
			`[payments:creem] ${what} is not configured — pass it on the input or set NEXT_PUBLIC_SAAS_URL.`,
		);
	}
	if (!/^https?:\/\//.test(url)) {
		throw new WebhookConfigError(
			`[payments:creem] ${what} must be an absolute http(s) URL, got "${url}".`,
		);
	}
	return url;
}

const CREEM_CANCEL_MODE = {
	immediate: "immediate",
	period_end: "scheduled",
} as const satisfies Record<CancelMode, string>;

const CREEM_PRORATION = {
	"charge-immediately": "proration-charge-immediately",
	none: "proration-none",
} as const satisfies Record<SeatProration, CreemUpdateBehavior>;

function mapCreemStatus(status: string): PurchaseStatusLiteral {
	switch (status) {
		case "active":
			return "ACTIVE";
		case "trialing":
			return "TRIALING";
		case "past_due":
		// Payment collection failed for good — the kit has no separate
		// unpaid state; Creem says to treat it like past_due.
		case "unpaid":
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
		case "subscription.unpaid":
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
	// Event time, Unix milliseconds.
	created_at: z.number().optional(),
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
		subscription: z.union([z.string(), z.object({ id: z.string() })]).nullish(),
		// Purchased units: checkout objects carry `units` at the top level,
		// subscription objects via `items[]`, renewals via the embedded
		// originating `checkout`.
		units: z.number().optional(),
		items: z.array(z.object({ units: z.number().optional() })).optional(),
		checkout: z
			.union([
				z.string(),
				z.object({
					id: z.string().optional(),
					units: z.number().optional(),
				}),
			])
			.nullish(),
		// refund.created / dispute.created: the refunded amount and the
		// transaction it was taken from.
		refund_amount: z.number().nullish(),
		transaction: z
			.union([
				z.string(),
				z.object({
					amount_paid: z.number().nullish(),
					status: z.string().nullish(),
				}),
			])
			.nullish(),
	}),
});

type CreemObject = z.infer<typeof creemWebhookSchema>["object"];

function refId(
	value: string | { id?: string } | null | undefined,
): string | undefined {
	if (!value) return undefined;
	return typeof value === "string" ? value : value.id;
}

/** Transaction statuses of a payment Creem took back in full. */
const REVERSED_TRANSACTION = new Set(["refunded", "chargedBack"]);

/**
 * A full refund: the transaction says so, or the refund covers the paid
 * amount. Without either it cannot be told from a partial refund — not a
 * reversal.
 */
function isFullRefund(object: CreemObject): boolean {
	const transaction =
		typeof object.transaction === "object" ? object.transaction : null;
	if (transaction?.status && REVERSED_TRANSACTION.has(transaction.status)) {
		return true;
	}
	return (
		object.refund_amount != null &&
		transaction?.amount_paid != null &&
		object.refund_amount >= transaction.amount_paid
	);
}

/** A unit count is only meaningful as a positive integer. */
function toUnits(value: number | undefined): number | undefined {
	return value !== undefined && Number.isInteger(value) && value > 0
		? value
		: undefined;
}

function getCustomerId(
	customer: string | { id: string; email?: string } | undefined,
): string | undefined {
	if (typeof customer === "string") {
		return customer;
	}
	return customer?.id;
}

const CreemCheckoutResponseSchema = z.object({
	id: z.string().optional(),
	checkout_url: z.string(),
});
const CreemPortalResponseSchema = z.object({
	customer_portal_link: z.string(),
});
const CreemCustomerResponseSchema = z.object({ id: z.string() });
const CreemSubscriptionResponseSchema = z.object({
	product: z.union([z.string(), z.object({ id: z.string() })]).optional(),
	items: z
		.array(
			z.object({
				id: z.string(),
				product_id: z.string().nullish(),
				price_id: z.string().nullish(),
				units: z.number().int().nullish(),
			}),
		)
		.optional(),
});

const ErrorBodySchema = z.record(z.string(), z.unknown());

/** Best-effort parse of an error body for logging — never throws. */
async function readErrorBody(response: Response) {
	const parsed = ErrorBodySchema.safeParse(
		await response.json().catch(() => null),
	);
	return parsed.success ? parsed.data : { raw: "unparseable" };
}

/** Creem's `message` — a string or a list of strings — as one line. */
function errorMessages(body: Record<string, unknown>): string {
	const { message } = body;
	if (typeof message === "string") return message;
	if (Array.isArray(message)) {
		return message.filter((m) => typeof m === "string").join("; ");
	}
	return "";
}

/**
 * Creem answers an unknown id with 404 or with 400 "… does not exist",
 * and a change the object's state refuses with 400 "… in state: x" /
 * "Cannot resume subscription in active status".
 */
const NOT_FOUND = /does not exist|not found/i;
const INVALID_STATE =
	/\bin (state|status)\b|cannot (be )?(cancel|resume|update|pause)/i;

/**
 * Log a failed Creem response and turn it into a typed error: 401/403 is
 * our configuration (wrong or missing key), everything else a
 * `ProviderRequestError` the caller can explain. Creem's own messages go
 * to the log and `detail`, never into the error message.
 */
async function creemFailure(
	response: Response,
	failure: string,
): Promise<Error> {
	const body = await readErrorBody(response);
	const status = response.status;
	log.error(failure, { status, ...body });
	if (status === 401 || status === 403) {
		return new WebhookConfigError(
			`[payments:creem] ${failure}: Creem rejected the API key (HTTP ${status}). Check CREEM_API_KEY and CREEM_TEST_MODE.`,
		);
	}
	const detail = errorMessages(body);
	const byStatus = failureKindForStatus(status);
	const kind =
		byStatus === "unavailable"
			? byStatus
			: NOT_FOUND.test(detail)
				? "not_found"
				: byStatus === "rejected" && INVALID_STATE.test(detail)
					? "invalid_state"
					: byStatus;
	return new ProviderRequestError(failure, kind, {
		status,
		detail: detail || undefined,
	});
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
	// Creem's checkout API has no trial parameter — trials are a product setting.
	trialsOnProduct: true,
	// Creem cancels a trialing subscription right away, even in
	// "scheduled" mode — there is no cancel at trial end.
	cancelEndsTrial: true,

	async createCheckoutLink(input: CheckoutInput) {
		// Note: Creem's checkout API does not accept a cancel_url parameter —
		// `input.cancelUrl` is intentionally ignored; buyers use the hosted
		// checkout page's back navigation. It has no trial parameter either —
		// `input.trialDays` is ignored; configure the trial on the Creem product.
		const response = await creemFetch("/checkouts", {
			method: "POST",
			body: JSON.stringify({
				product_id: input.priceId,
				units: input.seats ?? 1,
				success_url: requireAbsoluteUrl(
					input.successUrl ?? env.NEXT_PUBLIC_SAAS_URL,
					"checkout success URL (input.successUrl or NEXT_PUBLIC_SAAS_URL)",
				),
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
			throw await creemFailure(response, "Failed to create checkout link");
		}

		const { id, checkout_url } = await parseCreemResponse(
			response,
			CreemCheckoutResponseSchema,
			"Failed to create checkout link",
		);
		return { url: checkout_url, ...(id ? { checkoutId: id } : {}) };
	},

	async createCustomerPortalLink(input: PortalInput) {
		const response = await creemFetch("/customers/billing", {
			method: "POST",
			body: JSON.stringify({
				customer_id: input.customerId,
			}),
		});

		if (!response.ok) {
			throw await creemFailure(
				response,
				"Failed to create customer portal link",
			);
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
			throw await creemFailure(response, "Failed to create customer");
		}

		const { id } = await parseCreemResponse(
			response,
			CreemCustomerResponseSchema,
			"Failed to create customer",
		);
		return { customerId: id };
	},

	async cancelSubscription(
		subscriptionId: string,
		options?: CancelSubscriptionOptions,
	) {
		// Without a mode Creem applies the store's configured default.
		const mode = resolveCancelMode(options);
		const response = await creemFetch(
			`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
			{
				method: "POST",
				...(mode && {
					body: JSON.stringify({ mode: CREEM_CANCEL_MODE[mode] }),
				}),
			},
		);

		if (!response.ok) {
			throw await creemFailure(response, "Failed to cancel subscription");
		}
	},

	async resumeSubscription(subscriptionId: string) {
		const response = await creemFetch(
			`/subscriptions/${encodeURIComponent(subscriptionId)}/resume`,
			{ method: "POST" },
		);

		if (!response.ok) {
			throw await creemFailure(response, "Failed to resume subscription");
		}
	},

	async getSubscriptionStatus(subscriptionId: string) {
		const response = await creemFetch(
			`/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`,
			{ method: "GET" },
		);
		if (!response.ok) {
			throw await creemFailure(response, "Failed to get subscription status");
		}
		const { status } = await parseCreemResponse(
			response,
			z.object({ status: z.string() }),
			"Failed to get subscription status",
		);
		return mapCreemStatus(status);
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

		// A dispute or a full refund takes the payment back — of the
		// subscription it paid, else of the one-time checkout.
		if (eventType === "dispute.created" || eventType === "refund.created") {
			const object = payload.object;
			if (eventType === "refund.created" && !isFullRefund(object)) {
				log.info("partial or unclassified refund — not a reversal", {
					eventId: payload.id,
				});
				return [];
			}
			const eventId = payload.id ?? object.id;
			const occurredAt =
				payload.created_at === undefined
					? undefined
					: new Date(payload.created_at);
			const subscriptionId = refId(object.subscription);
			if (subscriptionId) {
				return [
					{ type: "payment.reversed", eventId, subscriptionId, occurredAt },
				];
			}
			const paymentRef = refId(object.checkout);
			return paymentRef
				? [{ type: "payment.reversed", eventId, paymentRef, occurredAt }]
				: [];
		}

		const mappedType = mapCreemEvent(eventType);

		if (!mappedType) {
			return [];
		}

		const object = payload.object;

		// Skip checkout.completed if it created a subscription (subscription events handle it)
		if (eventType === "checkout.completed" && refId(object.subscription)) {
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
			eventType === "checkout.completed" && !refId(object.subscription);
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
			units: toUnits(
				object.units ??
					object.items?.[0]?.units ??
					(typeof object.checkout === "object"
						? object.checkout?.units
						: undefined),
			),
			metadata: object.metadata,
			// The checkout id names a one-time purchase in a later refund.
			...(isOneTimeCheckout && object.id ? { paymentRef: object.id } : {}),
		};

		return [event];
	},

	async getSubscriptionSeats(subscriptionId: string) {
		const response = await creemFetch(
			`/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`,
			{ method: "GET" },
		);
		if (!response.ok) {
			throw await creemFailure(response, "Failed to get subscription");
		}
		const { items } = await parseCreemResponse(
			response,
			CreemSubscriptionResponseSchema,
			"Failed to get subscription",
		);
		// Creem reports `units` on every subscription item (1 without seats).
		const units = items?.[0]?.units;
		if (units == null || units < 1) {
			throw new Error("Creem subscription item has no unit count");
		}
		return units;
	},

	async setSubscriptionSeats(input: SetSeatsInput) {
		const { subscriptionId, seats, proration } = input;

		const getResponse = await creemFetch(
			`/subscriptions?subscription_id=${encodeURIComponent(subscriptionId)}`,
			{
				method: "GET",
			},
		);

		if (!getResponse.ok) {
			throw await creemFailure(getResponse, "Failed to get subscription");
		}

		const { items, product } = await parseCreemResponse(
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

		// UpsertSubscriptionItemEntity: { id, price_id | product_id, units } —
		// Creem resolves the item through its price or product and answers
		// 404 "Could not find product or price" without one.
		const subscriptionProductId =
			typeof product === "string" ? product : product?.id;
		const itemRef = firstItem.price_id
			? { price_id: firstItem.price_id }
			: firstItem.product_id
				? { product_id: firstItem.product_id }
				: subscriptionProductId
					? { product_id: subscriptionProductId }
					: null;
		if (!itemRef) {
			throw new Error(
				"Creem subscription item has no product or price — cannot update seats",
			);
		}

		const updateResponse = await creemFetch(
			`/subscriptions/${encodeURIComponent(subscriptionId)}`,
			{
				method: "POST",
				body: JSON.stringify({
					items: [{ id: firstItem.id, ...itemRef, units: seats }],
					update_behavior: proration
						? CREEM_PRORATION[proration]
						: paymentsConfig.creemUpdateBehavior,
				}),
			},
		);

		if (!updateResponse.ok) {
			throw await creemFailure(
				updateResponse,
				"Failed to update subscription seats",
			);
		}
	},
};
