/**
 * WebhookSync — shared, provider-agnostic business logic.
 *
 * Takes normalized `ProviderEvent[]` (from `provider.parseWebhook()`) and
 * mutates the `Purchase` table. This is the ONE place where webhook events
 * become database state, regardless of which provider emitted them.
 *
 * Key rules (extracted from real-world Creem/Stripe/Polar webhook handling):
 *   - Protected statuses: a renewal event must not undo a scheduled_cancel
 *   - Old subscriptions are canceled when a new one activates for the same owner
 *   - checkout.completed for one-time purchases creates a Purchase directly
 *   - checkout.completed for subscriptions is handled by subscription.activated
 *   - subscription.canceled respects currentPeriodEnd (scheduled_cancel if future)
 *   - Event failures propagate so the HTTP handler returns 5xx and the
 *     provider retries — a swallowed error is a silently dropped event
 */

import {
	grantRecurringCredits,
	grantTopUpCredits,
	resetRecurringCredits,
} from "@fuutu/credits";
import {
	createPurchase,
	getCreditBalance,
	getPurchaseByCheckoutEventId,
	getPurchaseByProviderSubscriptionId,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
	setOrganizationPaymentsCustomerId,
	setPaymentsCustomerId,
	updatePurchase,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { dispatchEvent, type WebhookEventType } from "@fuutu/webhooks";
import { z } from "zod";
import { CREDITS, type PlanId } from "./config";
import { getPlanIdForProductId } from "./config.server";
import { resolvePaymentProvider } from "./resolve";
import type {
	ProviderEvent,
	ProviderEventType,
	PurchaseStatusLiteral,
} from "./types";

const log = createLogger({ scope: "payments:sync" });

/** Statuses that must not be overwritten by a renewal/activation event. */
const PROTECTED_STATUSES: PurchaseStatusLiteral[] = [
	"SCHEDULED_CANCEL",
	"PAST_DUE",
	"PAUSED",
];

/** Statuses that count as "active" for feature gating. */
const ACTIVE_STATUSES: PurchaseStatusLiteral[] = ["ACTIVE", "TRIALING"];

/**
 * Map a ProviderEventType to the default PurchaseStatus when the event
 * payload doesn't carry an explicit status.
 */
const DEFAULT_STATUS_FOR_TYPE: Partial<
	Record<ProviderEventType, PurchaseStatusLiteral>
> = {
	"subscription.activated": "ACTIVE",
	"subscription.renewed": "ACTIVE",
	"subscription.updated": "ACTIVE",
	"subscription.past_due": "PAST_DUE",
	"subscription.paused": "PAUSED",
	"subscription.scheduled_cancel": "SCHEDULED_CANCEL",
	"subscription.canceled": "CANCELED",
	"subscription.expired": "EXPIRED",
	"checkout.completed": "ACTIVE",
	"one_time.purchased": "ACTIVE",
};

/** Prisma unique-violation error — a dedup marker already exists. */
const isUniqueViolation = (err: unknown): boolean =>
	err instanceof Error && "code" in err && err.code === "P2002";

/**
 * Process an array of normalized provider events and update the Purchase
 * table accordingly. Idempotent — re-processing the same event is safe
 * because we look up by provider+subscriptionId (subscriptions) or
 * provider+checkoutEventId (one-time checkouts) before mutating.
 *
 * Throws an AggregateError when any event failed — the webhook handler
 * turns that into a 5xx so the provider retries the delivery instead of
 * treating silently-dropped events as acknowledged.
 */
export async function processWebhookEvents(
	providerId: string,
	events: ProviderEvent[],
): Promise<void> {
	const failures: Error[] = [];
	for (const event of events) {
		try {
			await processSingleEvent(providerId, event);
		} catch (err) {
			log.error("failed to process webhook event", {
				provider: providerId,
				eventType: event.type,
				subscriptionId: event.subscriptionId,
				err: String(err),
			});
			failures.push(err instanceof Error ? err : new Error(String(err)));
		}
	}
	if (failures.length > 0) {
		throw new AggregateError(
			failures,
			`${failures.length} webhook event(s) failed for provider ${providerId}`,
		);
	}
}

async function processSingleEvent(
	providerId: string,
	event: ProviderEvent,
): Promise<void> {
	const { type, subscriptionId, productId, metadata } = event;
	const metadataUserId = extractId(metadata, "user_id");
	const metadataOrgId = extractId(metadata, "organization_id");
	// Owner XOR: exactly one owner column may be set on Purchase/credit
	// rows (DB CHECK constraint). When both ids arrive in checkout metadata
	// the organization owns the billing relationship — user_id stays in
	// metadata for attribution.
	const organizationId = metadataOrgId ? metadataOrgId : null;
	const userId = organizationId ? null : metadataUserId;

	log.info("processing webhook event", {
		provider: providerId,
		type,
		subscriptionId,
		productId,
		userId,
		organizationId,
	});

	// One-time purchase — checkout.completed without a subscription
	if (type === "checkout.completed" && !subscriptionId && productId) {
		await handleOneTimePurchase(providerId, event, userId, organizationId);
		return;
	}

	// checkout.completed with subscriptionId but no productId —
	// the subscription.created event will follow and create the purchase.
	// Skip this event to avoid creating a purchase without productId.
	if (type === "checkout.completed" && subscriptionId && !productId) {
		log.info(
			"checkout.completed with subscription, waiting for subscription.activated",
			{
				subscriptionId,
			},
		);
		return;
	}

	// Subscription events require a subscriptionId
	if (!subscriptionId) {
		log.warn("subscription event without subscriptionId, skipping", { type });
		return;
	}

	const existing = await getPurchaseByProviderSubscriptionId(
		providerId,
		subscriptionId,
	);

	if (existing) {
		const userIdToSet =
			!existing.userId && !existing.organizationId && userId ? userId : null;
		// The stored owner is authoritative — renewal/invoice events often
		// carry no user_id metadata, so fall back to the purchase row.
		await updateExistingPurchase(
			providerId,
			existing.id,
			event,
			existing.status,
			existing.userId ?? userId,
			existing.organizationId ?? organizationId,
			userIdToSet,
		);
		// Redelivered activation: re-attempt the recurring credit grant.
		// The original delivery may have created the purchase but failed
		// the grant (which propagates as 5xx and triggers a provider retry).
		// grantCreditsForSubscription skips meters whose balance already
		// matches, so a successful first delivery is a no-op here.
		if (isSubscriptionActivationType(type)) {
			await grantCreditsForSubscription(
				event,
				existing.userId ?? userId,
				existing.organizationId ?? organizationId,
			);
		}
		return;
	}

	// New subscription — create the Purchase row
	if (isSubscriptionActivationType(type)) {
		await createNewSubscriptionPurchase(
			providerId,
			event,
			userId,
			organizationId,
		);
	}
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

async function handleOneTimePurchase(
	providerId: string,
	event: ProviderEvent,
	userId: string | null,
	organizationId: string | null,
): Promise<void> {
	if (!event.productId) {
		log.warn("one_time.purchased without productId, skipping");
		return;
	}
	if (!userId && !organizationId) {
		// An ownerless purchase is rejected by the DB XOR constraint and
		// useless downstream — skip instead of retrying a poisoned event.
		log.error("checkout.completed without owner metadata, skipping", {
			productId: event.productId,
		});
		return;
	}

	// Idempotency: the provider event id is stored as
	// metadata.checkoutEventId and backed by a partial unique index on
	// (provider, metadata->>'checkoutEventId') — a redelivered
	// checkout.completed must not create a second Purchase.
	const eventId = event.eventId ?? null;
	if (eventId) {
		const existing = await getPurchaseByCheckoutEventId(providerId, eventId);
		if (existing) {
			log.info("duplicate checkout.completed, re-checking top-up grant", {
				eventId,
				purchaseId: existing.id,
			});
			// Still attempt the credit grant — it is idempotent via the
			// unique index on credit_package.purchaseId, and a previous
			// delivery may have created the purchase but failed the grant.
			await grantTopUpCreditsForPurchase(
				event,
				userId,
				organizationId,
				existing.id,
			);
			return;
		}
	}

	let purchaseId: string;
	try {
		const purchase = await createPurchase({
			type: "ONE_TIME",
			status: "ACTIVE",
			provider: providerId,
			priceId: event.productId,
			productId: event.productId,
			customerId: event.customerId ?? null,
			userId,
			organizationId,
			currentPeriodEnd: event.currentPeriodEnd ?? null,
			metadata: eventId
				? { ...(event.metadata ?? {}), checkoutEventId: eventId }
				: event.metadata,
		});
		purchaseId = purchase.id;
	} catch (err) {
		if (isUniqueViolation(err)) {
			// A concurrent redelivery won the race — treat as duplicate.
			log.info("duplicate checkout.completed (unique constraint)", {
				eventId,
			});
			return;
		}
		throw err;
	}
	log.info("created one-time purchase", {
		provider: providerId,
		productId: event.productId,
		userId,
		organizationId,
	});

	// Grant top-up credits if this product is a credit package. Failures
	// propagate — dedup above makes the provider's retry safe.
	await grantTopUpCreditsForPurchase(event, userId, organizationId, purchaseId);

	await emitWebhookEvent("invoice.paid", userId, organizationId, {
		purchaseId,
		productId: event.productId,
		provider: providerId,
	});
}

async function createNewSubscriptionPurchase(
	providerId: string,
	event: ProviderEvent,
	userId: string | null,
	organizationId: string | null,
): Promise<void> {
	if (!event.productId) {
		log.error("subscription activation without productId, skipping", {
			subscriptionId: event.subscriptionId,
		});
		return;
	}
	if (!userId && !organizationId) {
		log.error("subscription activation without owner metadata, skipping", {
			subscriptionId: event.subscriptionId,
		});
		return;
	}

	// Cancel old active subscriptions for the same owner (upgrade scenario)
	const subId = event.subscriptionId;
	if (!subId) {
		log.error("subscription activation without subscriptionId, skipping");
		return;
	}
	await cancelOldSubscriptionsForOwner(subId, userId, organizationId);

	const status =
		event.status ?? DEFAULT_STATUS_FOR_TYPE[event.type] ?? "ACTIVE";
	await createPurchase({
		type: "SUBSCRIPTION",
		status,
		provider: providerId,
		priceId: event.productId,
		productId: event.productId,
		subscriptionId: event.subscriptionId,
		customerId: event.customerId ?? null,
		userId,
		organizationId,
		currentPeriodEnd: event.currentPeriodEnd ?? null,
		metadata: event.metadata,
	});

	// Save the provider customer ID on the org or user so the portal
	// and other customer-scoped API calls can resolve it.
	const customerId = event.customerId ?? null;
	if (customerId) {
		if (organizationId) {
			await setOrganizationPaymentsCustomerId(organizationId, customerId);
		} else if (userId) {
			await setPaymentsCustomerId(userId, customerId);
		}
	}

	log.info("created subscription purchase", {
		provider: providerId,
		subscriptionId: event.subscriptionId,
		status,
		userId,
		organizationId,
	});

	// Grant recurring credits for the new subscription. Failures propagate
	// so the provider retries — the redelivery path above re-attempts the
	// grant against the already-created purchase.
	await grantCreditsForSubscription(event, userId, organizationId);

	await emitWebhookEvent("subscription.created", userId, organizationId, {
		subscriptionId: event.subscriptionId,
		productId: event.productId,
		status,
		provider: providerId,
	});
}

async function updateExistingPurchase(
	providerId: string,
	purchaseId: string,
	event: ProviderEvent,
	currentStatus: PurchaseStatusLiteral | string | null,
	userId: string | null,
	organizationId: string | null,
	userIdToSet: string | null = null,
): Promise<void> {
	// Protected statuses: don't let a renewal event undo a scheduled cancel
	const currentStatusLit = currentStatus as PurchaseStatusLiteral;
	const isProtected = PROTECTED_STATUSES.includes(currentStatusLit);

	// For canceled events, respect currentPeriodEnd
	let resolvedStatus = event.status ?? DEFAULT_STATUS_FOR_TYPE[event.type];
	if (event.type === "subscription.canceled" && event.currentPeriodEnd) {
		const periodEnd = new Date(event.currentPeriodEnd);
		if (periodEnd > new Date()) {
			resolvedStatus = "SCHEDULED_CANCEL";
		}
	}

	if (isProtected && isRenewalOrActivation(event.type)) {
		// Keep the protected status — don't overwrite with ACTIVE
		log.info("keeping protected status, ignoring renewal", {
			purchaseId,
			currentStatus: currentStatusLit,
			eventType: event.type,
		});
		// Still update period end and product if present
		await updatePurchase({
			id: purchaseId,
			...(userIdToSet && { userId: userIdToSet }),
			...(event.currentPeriodEnd !== undefined && {
				currentPeriodEnd: event.currentPeriodEnd,
			}),
			...(event.productId !== undefined && { priceId: event.productId }),
		});
		return;
	}

	await updatePurchase({
		id: purchaseId,
		...(userIdToSet && { userId: userIdToSet }),
		...(resolvedStatus && { status: resolvedStatus }),
		...(event.currentPeriodEnd !== undefined && {
			currentPeriodEnd: event.currentPeriodEnd,
		}),
		...(event.productId !== undefined && { priceId: event.productId }),
		...(event.customerId !== undefined && { customerId: event.customerId }),
	});
	log.info("updated purchase", { purchaseId, status: resolvedStatus });

	// Reset recurring credits on renewal. Failures propagate so the
	// provider retries — redelivery re-runs this idempotent reset.
	if (event.type === "subscription.renewed" && event.currentPeriodEnd) {
		await resetCreditsOnRenewal(event, userId, organizationId);
	}

	await emitWebhookEvent(
		event.type === "subscription.canceled"
			? "subscription.canceled"
			: "subscription.updated",
		userId,
		organizationId,
		{
			purchaseId,
			subscriptionId: event.subscriptionId,
			status: resolvedStatus,
			provider: providerId,
		},
	);
}

async function cancelOldSubscriptionsForOwner(
	newSubscriptionId: string,
	userId: string | null,
	organizationId: string | null,
): Promise<void> {
	const ownerPurchases = organizationId
		? await getPurchasesByOrganizationId(organizationId)
		: userId
			? await getPurchasesByUserId(userId)
			: [];

	const provider = resolvePaymentProvider();

	for (const old of ownerPurchases) {
		if (
			old.type === "SUBSCRIPTION" &&
			old.subscriptionId &&
			old.subscriptionId !== newSubscriptionId &&
			ACTIVE_STATUSES.includes(old.status as PurchaseStatusLiteral)
		) {
			try {
				// Cancel at the provider first — otherwise the customer
				// keeps getting billed for the old subscription.
				await provider.cancelSubscription(old.subscriptionId);
				log.info("canceled old subscription at provider", {
					oldSubscriptionId: old.subscriptionId,
					newSubscriptionId,
					provider: provider.id,
				});
			} catch (err) {
				// Provider cancel failed (already canceled, network error,
				// wrong provider for this subscription, etc.) — log but
				// continue to mark the DB as canceled so the user sees the
				// correct state.
				log.error("failed to cancel old subscription at provider", {
					oldSubscriptionId: old.subscriptionId,
					provider: provider.id,
					err: String(err),
				});
			}

			try {
				await updatePurchase({
					id: old.id,
					status: "CANCELED",
				});
				log.info("marked old subscription as canceled in DB", {
					oldSubscriptionId: old.subscriptionId,
					newSubscriptionId,
				});
			} catch (err) {
				// CRITICAL: Provider cancel succeeded but DB update failed.
				// This creates a double-billing risk — the provider thinks
				// the subscription is canceled, but our DB still shows it as active.
				// Manual intervention may be required to reconcile.
				log.error(
					"CRITICAL: failed to mark old subscription as canceled in DB after provider cancel succeeded",
					{
						oldSubscriptionId: old.subscriptionId,
						newSubscriptionId,
						provider: provider.id,
						err: String(err),
					},
				);
			}
		}
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractId(
	metadata: Record<string, unknown> | undefined,
	key: string,
): string | null {
	if (!metadata) return null;
	const value = metadata[key];
	return typeof value === "string" && value.length > 0 ? value : null;
}

function isSubscriptionActivationType(type: ProviderEventType): boolean {
	return (
		type === "subscription.activated" ||
		type === "subscription.renewed" ||
		type === "checkout.completed" ||
		type === "one_time.purchased"
	);
}

function isRenewalOrActivation(type: ProviderEventType): boolean {
	return (
		type === "subscription.renewed" ||
		type === "subscription.activated" ||
		type === "checkout.completed"
	);
}

/**
 * Emit a `WEBHOOK_EVENTS` event to subscribed endpoints. Best-effort:
 * a dispatch failure must not fail the provider-event mutation — the
 * billing state is authoritative, delivery problems surface in the
 * delivery worker and retries.
 */
async function emitWebhookEvent(
	event: WebhookEventType,
	userId: string | null,
	organizationId: string | null,
	payload: Record<string, unknown>,
): Promise<void> {
	try {
		await dispatchEvent({
			event,
			organizationId: organizationId ?? undefined,
			userId: organizationId ? undefined : (userId ?? undefined),
			payload,
		});
	} catch (err) {
		log.error("failed to dispatch webhook event", {
			event,
			err: String(err),
		});
	}
}

/**
 * Check if a user or organization has an active (ACTIVE or TRIALING)
 * subscription. Used by feature gates in the app.
 */
export async function hasActiveSubscription(
	userId?: string | null,
	organizationId?: string | null,
): Promise<boolean> {
	if (organizationId) {
		const { getActiveSubscriptionForOrganization } = await import("@fuutu/db");
		const purchase = await getActiveSubscriptionForOrganization(organizationId);
		return purchase !== null;
	}
	if (userId) {
		const { getActiveSubscriptionForUser } = await import("@fuutu/db");
		const purchase = await getActiveSubscriptionForUser(userId);
		return purchase !== null;
	}
	return false;
}

/**
 * Get the active subscription's plan ID for a user or organization.
 * Returns null if no active subscription exists.
 */
export async function getActivePlanId(
	userId?: string | null,
	organizationId?: string | null,
): Promise<string | null> {
	let purchase: Awaited<
		ReturnType<typeof import("@fuutu/db")["getActiveSubscriptionForUser"]>
	> = null;

	if (organizationId) {
		const { getActiveSubscriptionForOrganization } = await import("@fuutu/db");
		purchase = await getActiveSubscriptionForOrganization(organizationId);
	} else if (userId) {
		const { getActiveSubscriptionForUser } = await import("@fuutu/db");
		purchase = await getActiveSubscriptionForUser(userId);
	}

	if (!purchase) return null;
	return purchase.productId ?? purchase.priceId;
}

/**
 * Numeric credit grants for a plan — "unlimited" meters have no numeric
 * balance and are skipped (they are gated by plan, not by a counter).
 */
function numericGrantsForPlan(planId: PlanId): Record<string, number> {
	const planCredits = CREDITS[planId];
	const grants: Record<string, number> = {};
	for (const [meterKey, grant] of Object.entries(planCredits)) {
		if (typeof grant === "number" && grant > 0) {
			grants[meterKey] = grant;
		}
	}
	return grants;
}

/**
 * Grant recurring credits when a subscription is activated.
 * Looks up the plan from the product/price ID, then grants credits
 * for all meters configured for that plan.
 */
async function grantCreditsForSubscription(
	event: ProviderEvent,
	userId: string | null,
	organizationId: string | null,
): Promise<void> {
	if (!event.productId || (!userId && !organizationId)) return;

	// Find the plan ID from the product/price ID (checks runtime map + env vars)
	const planId = getPlanIdForProductId(event.productId);
	if (!planId) {
		log.info("no plan match for product ID, skipping credit grant", {
			productId: event.productId,
		});
		return;
	}

	const periodEnd =
		event.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

	for (const [meterKey, grant] of Object.entries(
		numericGrantsForPlan(planId),
	)) {
		// Idempotency: activation events are redelivered on retry. Skip
		// meters whose balance already reflects this exact grant — the
		// set-absolute write would be harmless, but the ledger must not
		// record a duplicate credit_event per redelivery.
		const existing = await getCreditBalance({
			userId: userId ?? undefined,
			organizationId: organizationId ?? undefined,
			meterKey,
		});
		if (
			existing &&
			existing.recurringGranted === grant &&
			existing.recurringPeriodEnd?.getTime() === periodEnd.getTime()
		) {
			continue;
		}
		await grantRecurringCredits({
			userId: userId ?? undefined,
			organizationId: organizationId ?? undefined,
			meterKey,
			amount: grant,
			periodEnd,
		});
	}

	log.info("granted credits for new subscription", {
		planId,
		userId,
		organizationId,
	});
}

/**
 * Reset recurring credit balances on subscription renewal.
 * Delegates to @fuutu/credits — a single transaction that also applies
 * the new plan's grants when the product maps to a plan.
 */
async function resetCreditsOnRenewal(
	event: ProviderEvent,
	userId: string | null,
	organizationId: string | null,
): Promise<void> {
	if (!event.currentPeriodEnd || (!userId && !organizationId)) return;

	const planId = event.productId
		? getPlanIdForProductId(event.productId)
		: undefined;
	const newGranted = planId ? numericGrantsForPlan(planId) : undefined;

	await resetRecurringCredits({
		userId: userId ?? undefined,
		organizationId: organizationId ?? undefined,
		newPeriodEnd: new Date(event.currentPeriodEnd),
		newGranted,
	});

	log.info("reset credits on renewal", { userId, organizationId });
}

const NestedTopupMetadataSchema = z.object({
	meterKey: z.string().min(1),
	amount: z.number().int().positive(),
	expiryDays: z.number().int().positive().optional(),
});

const FlatTopupMetadataSchema = z.object({
	meter_key: z.string().min(1),
	amount: z.number().int().positive(),
	expiryDays: z.number().int().positive().optional(),
});

/**
 * Grant top-up credits for a one-time purchase.
 * Top-up detection relies on metadata passed from the checkout:
 * - Nested format: { credit_topup: { meterKey, amount, expiryDays? } }
 * - Flat format: { topup_id, meter_key, amount, expiryDays? }
 *
 * Both formats are Zod-validated — malformed metadata is skipped, never cast.
 */
async function grantTopUpCreditsForPurchase(
	event: ProviderEvent,
	userId: string | null,
	organizationId: string | null,
	purchaseId: string,
): Promise<void> {
	if (!event.productId || (!userId && !organizationId)) return;

	const metadata = event.metadata;
	const nested = NestedTopupMetadataSchema.safeParse(metadata?.credit_topup);
	const flat =
		metadata?.topup_id !== undefined
			? FlatTopupMetadataSchema.safeParse(metadata)
			: null;

	const topupInfo = nested.success
		? nested.data
		: flat?.success
			? {
					meterKey: flat.data.meter_key,
					amount: flat.data.amount,
					expiryDays: flat.data.expiryDays,
				}
			: undefined;

	if (!topupInfo) {
		// Not a credit top-up purchase — skip silently
		return;
	}

	const expiresAt = topupInfo.expiryDays
		? new Date(Date.now() + topupInfo.expiryDays * 24 * 60 * 60 * 1000)
		: null;

	await grantTopUpCredits({
		userId: userId ?? undefined,
		organizationId: organizationId ?? undefined,
		meterKey: topupInfo.meterKey,
		amount: topupInfo.amount,
		expiresAt,
		purchaseId,
	});

	log.info("granted top-up credits for one-time purchase", {
		purchaseId,
		meterKey: topupInfo.meterKey,
		amount: topupInfo.amount,
		userId,
		organizationId,
	});
}
