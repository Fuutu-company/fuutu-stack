import {
	getOrganizationSeatSubscriptions,
	getPurchasesByOrganizationId,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { getPlanSubscription } from "./billing-policy";
import { PLANS, paymentsConfig } from "./config";
import { getPlanIdForProductId } from "./config.server";
import { resolvePaymentProvider, resolvePaymentProviderById } from "./resolve";
import {
	isSeatAware,
	type PaymentProvider,
	type PurchaseStatusLiteral,
} from "./types";

const log = createLogger({ scope: "payments:seats" });

/**
 * Sync the seat count of an organization's active subscription with the
 * payment provider. Called from Better-Auth organization hooks.
 *
 * Strategy:
 *   - Look up the org's current active subscription (`Purchase` row).
 *   - Call `provider.setSubscriptionSeats({ subscriptionId, seats })`.
 *
 * No-op when:
 *   - The provider owns seat sync (e.g. a provider plugin that auto-syncs)
 *   - The provider doesn't support seat management (not SeatAware)
 *   - The org has no active subscription
 *   - The subscription belongs to another provider (after a provider switch)
 *   - The subscribed plan is not `seatBased` (flat price — quantity stays)
 */
export async function updateSeatsInOrganizationSubscription(
	organizationId: string,
	seats: number,
): Promise<void> {
	const provider = resolvePaymentProvider();

	if (provider.ownsSeatSync) {
		log.debug("skip seats sync — provider owns it", {
			provider: provider.id,
			organizationId,
			seats,
		});
		return;
	}

	if (!isSeatAware(provider)) {
		log.debug("skip seats sync — provider is not seat-aware", {
			provider: provider.id,
			organizationId,
		});
		return;
	}

	// The plan subscription — an add-on (`Plan.addonOf`) keeps its own quantity.
	const subscription = await getPlanSubscription({ organizationId });
	if (!subscription?.subscriptionId) {
		log.info("no active subscription — skipping seat sync", {
			organizationId,
			seats,
		});
		return;
	}

	if (subscription.provider !== provider.id) {
		log.warn("skip seats sync — subscription belongs to another provider", {
			provider: provider.id,
			subscriptionProvider: subscription.provider,
			organizationId,
		});
		return;
	}

	// Only seat-based plans bill per member — a flat-priced plan must keep
	// its quantity. An unmapped product cannot be proven seat-based.
	const planId = getPlanIdForProductId(
		subscription.productId ?? subscription.priceId,
	);
	const seatBased = planId ? PLANS[planId].seatBased === true : false;
	if (!seatBased) {
		log.debug("skip seats sync — plan is not seat-based", {
			organizationId,
			planId: planId ?? null,
		});
		return;
	}

	// Never send quantity 0 or negative to the provider — a member count
	// of 0 can arrive transiently (e.g. last member mid-removal).
	if (seats < 1) {
		log.warn("resolved seat count < 1 — skipping provider seat sync", {
			organizationId,
			subscriptionId: subscription.subscriptionId,
			seats,
		});
		return;
	}

	await provider.setSubscriptionSeats({
		subscriptionId: subscription.subscriptionId,
		seats,
	});
	log.info("seats synced", { organizationId, seats });
}

export type SeatReconcileResult = {
	/** Seat-based org subscriptions compared with their member count. */
	checked: number;
	/** Seat counts sent to the provider. */
	synced: number;
	/** Syncs that failed — logged per organization, retried next run. */
	failed: number;
};

/**
 * Re-sync every seat-based organization subscription whose billed seats
 * differ from the member count — the safety net for a membership-hook sync
 * that failed (provider down) or a checkout with fewer seats than members.
 * Run daily by the `seat-reconcile` cron job. Each failure is logged and
 * counted; the rest carry on. No-op when `paymentsConfig.seatSync` is
 * "none". Same skips as `updateSeatsInOrganizationSubscription`.
 */
export async function reconcileOrganizationSeats(): Promise<SeatReconcileResult> {
	const result: SeatReconcileResult = { checked: 0, synced: 0, failed: 0 };
	if (paymentsConfig.seatSync === "none") return result;
	const subscriptions = await getOrganizationSeatSubscriptions();
	for (const sub of subscriptions) {
		const planId = getPlanIdForProductId(sub.productId ?? sub.priceId);
		if (!planId || PLANS[planId].seatBased !== true) continue;
		result.checked++;
		if (sub.memberCount === sub.quantity) continue;
		try {
			await updateSeatsInOrganizationSubscription(
				sub.organizationId,
				sub.memberCount,
			);
			result.synced++;
		} catch (err) {
			result.failed++;
			log.error("seat reconcile failed — billed seats differ from members", {
				organizationId: sub.organizationId,
				subscriptionId: sub.subscriptionId,
				billedSeats: sub.quantity,
				members: sub.memberCount,
				err: String(err),
			});
		}
	}
	return result;
}

/**
 * Cancel every active subscription for an organization. Called from the
 * `organization.delete.before` hook to avoid dangling paid seats after a
 * workspace is removed.
 *
 * Local `Purchase` rows are not marked CANCELED here — the Prisma
 * `Purchase.organization` relation is `onDelete: Cascade`, so the rows
 * are removed with the organization. The provider-side cancel is the
 * authoritative stop-billing action; any `subscription.canceled` webhook
 * that arrives before deletion resolves on a gone row harmlessly.
 */
export async function cancelAllSubscriptionsForOrganization(
	organizationId: string,
): Promise<void> {
	const purchases = await getPurchasesByOrganizationId(organizationId);
	for (const p of purchases) {
		if (p.type !== "SUBSCRIPTION" || !p.subscriptionId) continue;
		if (p.status !== "ACTIVE" && p.status !== "TRIALING") continue;
		// The purchase's own provider — never the active one by default,
		// which would receive a foreign subscription id after a switch.
		const provider = resolvePaymentProviderById(p.provider);
		if (!provider) {
			log.warn(
				"subscription's provider is not available — cancel it manually at that provider",
				{
					organizationId,
					subscriptionId: p.subscriptionId,
					subscriptionProvider: p.provider,
				},
			);
			continue;
		}
		try {
			await provider.cancelSubscription(p.subscriptionId, {
				mode: "immediate",
			});
		} catch (err) {
			log.error("cancelSubscription failed", {
				organizationId,
				subscriptionId: p.subscriptionId,
				err: String(err),
			});
		}
	}
}

/**
 * Statuses a strict cancel must end — the subscription can still charge:
 * PAST_DUE retries its open invoice, PAUSED bills again on resume and
 * INCOMPLETE can still collect its first invoice (Stripe/Polar until it
 * expires). SCHEDULED_CANCEL never renews; CANCELED/EXPIRED are terminal.
 */
export const CHARGEABLE_SUBSCRIPTION_STATUSES: readonly PurchaseStatusLiteral[] =
	["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED", "INCOMPLETE"];

/**
 * Cancels a subscription now through `provider` for strict callers. A
 * refused cancel counts as done only when the provider reports the
 * subscription CANCELED/EXPIRED (e.g. an INCOMPLETE row that already
 * expired there and cannot be cancelled again); otherwise it rethrows.
 */
export async function cancelSubscriptionNowOrThrow(
	provider: PaymentProvider,
	subscriptionId: string,
): Promise<void> {
	try {
		await provider.cancelSubscription(subscriptionId, { mode: "immediate" });
	} catch (err) {
		const status = await provider
			.getSubscriptionStatus?.(subscriptionId)
			.catch(() => undefined);
		if (status === "CANCELED" || status === "EXPIRED") {
			log.info("subscription already ended at the provider", {
				subscriptionId,
				status,
			});
			return;
		}
		throw err;
	}
}

/**
 * Strict `cancelAllSubscriptionsForOrganization` for callers that must not
 * delete while billing continues (support deletes): still tries every
 * subscription that can still charge (`CHARGEABLE_SUBSCRIPTION_STATUSES`),
 * then rejects if any could not be cancelled — also one whose provider is
 * not available.
 */
export async function cancelAllSubscriptionsForOrganizationOrThrow(
	organizationId: string,
): Promise<void> {
	const purchases = await getPurchasesByOrganizationId(organizationId);
	let attempted = 0;
	let failed = 0;
	for (const p of purchases) {
		if (p.type !== "SUBSCRIPTION" || !p.subscriptionId) continue;
		if (!CHARGEABLE_SUBSCRIPTION_STATUSES.includes(p.status)) continue;
		attempted++;
		const provider = resolvePaymentProviderById(p.provider);
		if (!provider) {
			failed++;
			log.warn(
				"subscription's provider is not available — cancel it manually at that provider",
				{
					organizationId,
					subscriptionId: p.subscriptionId,
					subscriptionProvider: p.provider,
				},
			);
			continue;
		}
		try {
			await cancelSubscriptionNowOrThrow(provider, p.subscriptionId);
		} catch (err) {
			failed++;
			log.error("cancelSubscription failed", {
				organizationId,
				subscriptionId: p.subscriptionId,
				err: String(err),
			});
		}
	}
	if (failed > 0) {
		throw new Error(
			`${failed} of ${attempted} subscriptions could not be cancelled`,
		);
	}
}
