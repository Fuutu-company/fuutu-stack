import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { Polar } from "@polar-sh/sdk";
import { SDKValidationError } from "@polar-sh/sdk/models/errors/sdkvalidationerror.js";
import {
	validateEvent,
	WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";
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

const log = createLogger({ scope: "payments:polar" });

/**
 * Subset of the Polar webhook `data` object we actually consume.
 * `validateEvent` already verified the signature, but its return type is a
 * broad union — validate the fields we read instead of casting.
 * user_id / organization_id live in `data.metadata` (set at checkout
 * creation), not on the event object itself.
 *
 * IMPORTANT: `validateEvent` returns the POST-TRANSFORM models — the SDK's
 * inbound zod schemas remap the wire format (billing_reason→billingReason,
 * subscription_id→subscriptionId, *_at → Date objects). This schema must
 * read the camelCase model, not the wire payload. Only event types in
 * `PARSED_POLAR_EVENT_TYPES` reach this schema — `id` is required on all
 * of them, so a shape that lacks it fails here → 400.
 */
const PolarEventDataSchema = z
	.looseObject({
		id: z.string(),
		status: z.string().optional(),
		billingReason: z.string().optional(),
		cancelAtPeriodEnd: z.boolean().optional(),
		currentPeriodEnd: z.union([z.date(), z.string()]).nullish(),
		endsAt: z.union([z.date(), z.string()]).nullish(),
		subscriptionId: z.string().nullish(),
		checkoutId: z.string().nullish(),
		customerId: z.string().nullish(),
		productId: z.string().nullish(),
		// Orders can report productId=null while the product lives on the
		// nested product object (OrderProduct). items[] carries price ids
		// (productPriceId), not product ids — wrong granularity here.
		product: z.looseObject({ id: z.string() }).nullish(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.optional();

type PolarEventData = z.infer<typeof PolarEventDataSchema>;

let _client: Polar | null = null;

/**
 * Lazy-init the Polar SDK client. Avoids throwing at module load when the
 * access token is absent in dev — callers trigger the real check on use.
 */
function getClient(): Polar {
	if (_client) return _client;
	if (!env.POLAR_ACCESS_TOKEN) {
		throw new WebhookConfigError(
			"[payments:polar] POLAR_ACCESS_TOKEN is not set. Configure it in @fuutu/env/saas before using Polar-backed flows.",
		);
	}
	_client = new Polar({
		accessToken: env.POLAR_ACCESS_TOKEN,
		server: env.NODE_ENV === "production" ? "production" : "sandbox",
	});
	return _client;
}

/**
 * Provider APIs require absolute URLs. Env fallbacks are optional, so a
 * resolved value can be undefined — and a caller-supplied value can be
 * relative. Fail fast with a config error instead of handing the provider
 * an unusable URL.
 */
function requireAbsoluteUrl(
	url: string | null | undefined,
	what: string,
): string {
	if (!url) {
		throw new WebhookConfigError(
			`[payments:polar] ${what} is not configured — pass it on the input or set the matching env fallback.`,
		);
	}
	if (!/^https?:\/\//.test(url)) {
		throw new WebhookConfigError(
			`[payments:polar] ${what} must be an absolute http(s) URL, got "${url}".`,
		);
	}
	return url;
}

function mapPolarStatus(status: string): PurchaseStatusLiteral {
	switch (status) {
		case "active":
			return "ACTIVE";
		case "trialing":
			return "TRIALING";
		case "past_due":
		case "unpaid":
			return "PAST_DUE";
		case "paused":
			return "PAUSED";
		case "canceled":
			return "CANCELED";
		case "incomplete_expired":
			return "EXPIRED";
		default:
			return "INCOMPLETE";
	}
}

/**
 * Map a Polar event type + its payload data to the normalized event type.
 * Several Polar types need the payload to disambiguate (checkout.updated
 * status, order.paid billing_reason, canceled cancel_at_period_end).
 */
/**
 * Polar event types whose `data` payload we inspect. Types outside this
 * set are acked BEFORE the strict data schema runs — their payload shape
 * isn't guaranteed by `PolarEventDataSchema` (e.g. `benefit_grant.created`
 * carries no `id`), and rejecting a valid signed event would 400 the
 * webhook endpoint into infinite provider retries.
 */
const PARSED_POLAR_EVENT_TYPES = new Set([
	"checkout.updated",
	"order.paid",
	"subscription.created",
	"subscription.active",
	"subscription.updated",
	"subscription.past_due",
	"subscription.paused",
	"subscription.resumed",
	"subscription.canceled",
	"subscription.uncanceled",
	"subscription.revoked",
]);

function mapPolarEventToProviderEvent(
	polarEventType: string,
	data: PolarEventData,
): ProviderEventType | null {
	switch (polarEventType) {
		// Polar never emits `checkout.completed` — a `checkout.updated`
		// reaching `succeeded` is the real completion signal. Other
		// statuses (open/confirmed/expired/failed) are noise.
		case "checkout.updated":
			return data?.status === "succeeded" ? "checkout.completed" : null;
		// order.paid is the reliable payment signal: subscription_cycle →
		// renewal; purchase (or no linked subscription) → one-time purchase.
		// subscription_create/_update are covered by subscription.* events.
		case "order.paid":
			if (data?.billingReason === "subscription_cycle") {
				return "subscription.renewed";
			}
			// An order tied to a hosted checkout already emitted
			// checkout.completed via checkout.updated(succeeded) — emitting
			// one_time.purchased too would create a duplicate Purchase row
			// (different dedup key) and double-grant credits.
			if (data?.checkoutId != null) {
				return null;
			}
			if (data?.billingReason === "purchase" || data?.subscriptionId == null) {
				return "one_time.purchased";
			}
			return null;
		// subscription.created fires BEFORE the first payment clears —
		// mapping it to activated would cancel the owner's existing
		// subscription and grant credits pre-payment. The real activation
		// signal is subscription.active (also fires on payment recovery);
		// created is informational only.
		case "subscription.created":
			return null;
		// Fires on activation and on recovery from past_due.
		case "subscription.active":
			return "subscription.activated";
		case "subscription.updated":
			return "subscription.updated";
		case "subscription.past_due":
			return "subscription.past_due";
		case "subscription.paused":
			return "subscription.paused";
		case "subscription.resumed":
			return "subscription.activated";
		case "subscription.canceled":
			return data?.cancelAtPeriodEnd === true
				? "subscription.scheduled_cancel"
				: "subscription.canceled";
		case "subscription.uncanceled":
			return "subscription.updated";
		case "subscription.revoked":
			return "subscription.expired";
		default:
			// Unmapped Polar events (customer.created, benefit.granted, …) are
			// ignored — coercing them to subscription.updated would feed
			// unrelated payloads into the purchase sync.
			return null;
	}
}

export const polarPaymentProvider: SeatAwarePaymentProvider = {
	id: "polar",
	ownsSeatSync: false,

	async createCheckoutLink(input: CheckoutInput) {
		const client = getClient();
		// Without metadata, Polar webhook payloads carry no owner — the
		// owner-XOR rule in sync.ts would skip them as ownerless.
		const metadata: Record<string, string> = {};
		for (const [key, value] of Object.entries(input.metadata ?? {})) {
			if (value === undefined || value === null) continue;
			metadata[key] = String(value);
		}
		// Owner keys after the caller metadata — they must win collisions so
		// the signed webhook can't be pointed at a different billing owner.
		if (input.userId) metadata.user_id = input.userId;
		if (input.organizationId) metadata.organization_id = input.organizationId;
		const checkout = await client.checkouts.create({
			products: [input.priceId],
			successUrl: requireAbsoluteUrl(
				input.successUrl ?? env.POLAR_SUCCESS_URL,
				"checkout success URL (input.successUrl or POLAR_SUCCESS_URL)",
			),
			externalCustomerId: input.userId ?? input.organizationId,
			seats: input.seats,
			metadata,
		});
		return { url: checkout.url };
	},

	async createCustomerPortalLink(input: PortalInput) {
		const client = getClient();
		const session = await client.customerSessions.create({
			customerId: input.customerId,
			returnUrl: input.returnUrl,
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
			throw new WebhookConfigError("POLAR_WEBHOOK_SECRET is not configured");
		}

		const body = await request.text();
		const headers: Record<string, string> = {};
		request.headers.forEach((value, key) => {
			headers[key] = value;
		});

		let event: ReturnType<typeof validateEvent>;
		try {
			event = validateEvent(body, headers, env.POLAR_WEBHOOK_SECRET);
		} catch (err) {
			if (err instanceof WebhookVerificationError) {
				throw new WebhookSignatureError(`signature: ${err.message}`);
			}
			if (err instanceof SDKValidationError) {
				// The SDK wraps every parse failure in "Failed to parse event";
				// its unknown-type branch nests a second SDKValidationError
				// ("Unknown event type: …") as the cause. A type this SDK
				// version doesn't know yet is acked so Polar doesn't retry it
				// forever; a schema mismatch on a known type is malformed.
				if (err.cause instanceof SDKValidationError) {
					log.debug("ignoring polar event type unknown to SDK", {
						err: err.message,
					});
					return [];
				}
				throw new Error("Malformed webhook payload");
			}
			throw err;
		}

		if (!PARSED_POLAR_EVENT_TYPES.has(event.type)) {
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

		const eventType = mapPolarEventToProviderEvent(event.type, data);
		if (!eventType) {
			log.debug("ignoring unmapped polar event type", {
				polarEventType: event.type,
			});
			return [];
		}

		// subscription.* payloads carry the subscription id as `id`;
		// order/checkout payloads expose it as `subscriptionId`. Never
		// fall back to `id` for non-subscription events — that would turn
		// an order/checkout id into a bogus subscriptionId.
		const isSubscriptionPayload = event.type.startsWith("subscription.");
		const subscriptionId = isSubscriptionPayload
			? (data?.subscriptionId ?? data?.id ?? undefined)
			: (data?.subscriptionId ?? undefined);

		const providerEvent: ProviderEvent = {
			type: eventType,
			// Standard-webhooks delivery id — dedup marker for
			// checkout.completed redeliveries. Falls back to the
			// payload id (checkout/order id) when the header is absent.
			eventId: headers["webhook-id"] || data?.id || undefined,
			metadata: data?.metadata,
			subscriptionId,
			customerId: data?.customerId ?? undefined,
			// Order.productId can be null — the product then lives on the
			// nested product object (OrderProduct.id).
			productId: data?.productId ?? data?.product?.id ?? undefined,
		};

		if (isSubscriptionPayload) {
			// scheduled_cancel / expired are derived transitions —
			// data.status still reports the pre-transition state, so the
			// derived event type is authoritative there.
			if (eventType === "subscription.scheduled_cancel") {
				providerEvent.status = "SCHEDULED_CANCEL";
			} else if (eventType === "subscription.expired") {
				providerEvent.status = "EXPIRED";
			} else if (data?.status) {
				providerEvent.status = mapPolarStatus(data.status);
			}
			// endsAt is the effective end for revoked/canceled subs;
			// currentPeriodEnd is authoritative when present. The SDK
			// already transformed both to Date objects.
			const periodEnd = data?.currentPeriodEnd ?? data?.endsAt;
			if (periodEnd) {
				providerEvent.currentPeriodEnd =
					periodEnd instanceof Date ? periodEnd : new Date(periodEnd);
			}
		}

		return [providerEvent];
	},

	async cancelSubscription(subscriptionId: string) {
		const client = getClient();
		await client.subscriptions.revoke({ id: subscriptionId });
		log.info("cancelled subscription", { subscriptionId });
	},

	async setSubscriptionSeats({ subscriptionId, seats }: SetSeatsInput) {
		const client = getClient();
		// prorationBehavior omitted — Polar applies the organization's
		// configured default, matching the Stripe seat-update behavior.
		await client.subscriptions.update({
			id: subscriptionId,
			subscriptionUpdate: { seats },
		});
		log.info("updated subscription seats", { subscriptionId, seats });
	},
};
