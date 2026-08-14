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
 */

import {
	createPurchase,
	getPurchaseByProviderSubscriptionId,
	getPurchasesByOrganizationId,
	getPurchasesByUserId,
	setOrganizationPaymentsCustomerId,
	setPaymentsCustomerId,
	updatePurchase,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
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

/**
 * Process an array of normalized provider events and update the Purchase
 * table accordingly. Idempotent — re-processing the same event is safe
 * because we look up by provider+subscriptionId before mutating.
 */
export async function processWebhookEvents(
	providerId: string,
	events: ProviderEvent[],
): Promise<void> {
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
		}
	}
}

async function processSingleEvent(
	providerId: string,
	event: ProviderEvent,
): Promise<void> {
	const { type, subscriptionId, productId, metadata } = event;
	const userId = extractId(metadata, "user_id");
	const organizationId = extractId(metadata, "organization_id");

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
		// If the existing purchase has no userId but this event does,
		// update it (covers the case where subscription.created arrived
		// before checkout.completed and metadata wasn't on the subscription).
		if (!existing.userId && userId) {
			await updatePurchase({ id: existing.id, userId, organizationId });
		}
		await updateExistingPurchase(
			existing.id,
			event,
			existing.status,
			userId,
			organizationId,
		);
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
		metadata: event.metadata,
	});
	log.info("created one-time purchase", {
		provider: providerId,
		productId: event.productId,
		userId,
		organizationId,
	});

	// Grant top-up credits if this product is a credit package
	try {
		await grantTopUpCreditsForPurchase(
			event,
			userId,
			organizationId,
			purchase.id,
		);
	} catch (err) {
		log.error("failed to grant top-up credits for one-time purchase", {
			purchaseId: purchase.id,
			err: String(err),
		});
	}
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

	// Grant recurring credits for the new subscription
	try {
		await grantCreditsForSubscription(event, userId, organizationId);
	} catch (err) {
		log.error("failed to grant credits for new subscription", {
			subscriptionId: event.subscriptionId,
			err: String(err),
		});
	}
}

async function updateExistingPurchase(
	purchaseId: string,
	event: ProviderEvent,
	currentStatus: PurchaseStatusLiteral | string | null,
	userId: string | null,
	organizationId: string | null,
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
			...(event.currentPeriodEnd !== undefined && {
				currentPeriodEnd: event.currentPeriodEnd,
			}),
			...(event.productId !== undefined && { priceId: event.productId }),
		});
		return;
	}

	await updatePurchase({
		id: purchaseId,
		...(resolvedStatus && { status: resolvedStatus }),
		...(event.currentPeriodEnd !== undefined && {
			currentPeriodEnd: event.currentPeriodEnd,
		}),
		...(event.productId !== undefined && { priceId: event.productId }),
		...(event.customerId !== undefined && { customerId: event.customerId }),
	});
	log.info("updated purchase", { purchaseId, status: resolvedStatus });

	// Reset recurring credits on renewal
	if (event.type === "subscription.renewed" && event.currentPeriodEnd) {
		try {
			await resetCreditsOnRenewal(event, userId, organizationId);
		} catch (err) {
			log.error("failed to reset credits on renewal", {
				purchaseId,
				err: String(err),
			});
		}
	}
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
				log.error("failed to cancel old subscription in DB", {
					oldSubscriptionId: old.subscriptionId,
					err: String(err),
				});
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

	// Import dynamically to avoid circular dependency (credits imports payments config)
	const { CREDITS, getMeterKeysForPlan, getPlanIdForProductId } = await import(
		"./config"
	);
	const { grantRecurringCredits } = await import("@fuutu/credits");

	// Find the plan ID from the product/price ID (checks runtime map + env vars)
	const planId = getPlanIdForProductId(event.productId);
	if (!planId) {
		log.info("no plan match for product ID, skipping credit grant", {
			productId: event.productId,
		});
		return;
	}

	const meterKeys = getMeterKeysForPlan(planId);
	const periodEnd =
		event.currentPeriodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

	for (const meterKey of meterKeys) {
		const grant = CREDITS[planId]?.[meterKey];
		if (typeof grant === "number" && grant > 0) {
			await grantRecurringCredits({
				userId: userId ?? undefined,
				organizationId: organizationId ?? undefined,
				meterKey,
				amount: grant,
				periodEnd,
			});
		}
	}

	log.info("granted credits for new subscription", {
		planId,
		userId,
		organizationId,
	});
}

/**
 * Reset recurring credit balances on subscription renewal.
 */
async function resetCreditsOnRenewal(
	event: ProviderEvent,
	userId: string | null,
	organizationId: string | null,
): Promise<void> {
	if (!event.currentPeriodEnd || (!userId && !organizationId)) return;

	const { resetRecurringCredits } = await import("@fuutu/credits");

	await resetRecurringCredits({
		userId: userId ?? undefined,
		organizationId: organizationId ?? undefined,
		newPeriodEnd: new Date(event.currentPeriodEnd),
	});

	log.info("reset credits on renewal", { userId, organizationId });
}

/**
 * Grant top-up credits for a one-time purchase.
 * The product ID must match a configured top-up product.
 * Top-up products are identified by a naming convention or explicit mapping.
 *
 * For now, we check if the productId starts with "topup_" or contains "_topup_"
 * and extract the meter key and amount from the metadata.
 *
 * In a production system, you'd have a TOPUP_PRODUCTS config mapping
 * product IDs to (meterKey, amount, expiryDays).
 */
async function grantTopUpCreditsForPurchase(
	event: ProviderEvent,
	userId: string | null,
	organizationId: string | null,
	purchaseId: string,
): Promise<void> {
	if (!event.productId || (!userId && !organizationId)) return;

	// Check metadata for credit top-up info
	// Support both formats:
	// 1. Flat: { topup_id, meter_key, amount }
	// 2. Nested: { credit_topup: { meterKey, amount, expiryDays? } }
	const metadata = event.metadata as Record<string, unknown> | undefined;
	const topupInfo =
		(metadata?.credit_topup as
			| { meterKey: string; amount: number; expiryDays?: number }
			| undefined) ||
		(metadata?.topup_id && metadata?.meter_key && metadata?.amount
			? {
					meterKey: metadata.meter_key as string,
					amount: metadata.amount as number,
					expiryDays: metadata.expiryDays as number | undefined,
				}
			: undefined);

	if (!topupInfo) {
		// Not a credit top-up purchase — skip silently
		return;
	}

	const { grantTopUpCredits } = await import("@fuutu/credits");

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
