import { getPurchasesByOrganizationId } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { getPlanSubscription } from "./billing-policy";
import { PLANS } from "./config";
import { getPlanIdForProductId } from "./config.server";
import { resolvePaymentProvider, resolvePaymentProviderById } from "./resolve";
import { isSeatAware } from "./types";

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
 *
 * Failures are logged and the rest still cancelled. `failOnError` then
 * rejects (also for a subscription whose provider is not available) — for
 * callers that must not delete while billing continues.
 */
export async function cancelAllSubscriptionsForOrganization(
	organizationId: string,
	options: { failOnError?: boolean } = {},
): Promise<void> {
	const purchases = await getPurchasesByOrganizationId(organizationId);
	let attempted = 0;
	let failed = 0;
	for (const p of purchases) {
		if (p.type !== "SUBSCRIPTION" || !p.subscriptionId) continue;
		if (p.status !== "ACTIVE" && p.status !== "TRIALING") continue;
		attempted++;
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
			failed++;
			continue;
		}
		try {
			await provider.cancelSubscription(p.subscriptionId, {
				mode: "immediate",
			});
		} catch (err) {
			failed++;
			log.error("cancelSubscription failed", {
				organizationId,
				subscriptionId: p.subscriptionId,
				err: String(err),
			});
		}
	}
	if (options.failOnError && failed > 0) {
		throw new Error(
			`${failed} of ${attempted} subscriptions could not be cancelled`,
		);
	}
}
