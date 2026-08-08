import {
	getActiveSubscriptionForOrganization,
	getPurchasesByOrganizationId,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { resolvePaymentProvider } from "./resolve";

const log = createLogger({ scope: "payments:seats" });

/**
 * Sync the seat count of an organization's active subscription with the
 * payment provider. Called from Better-Auth organization hooks.
 *
 * Strategy:
 *   - Look up the org's current active subscription (`Purchase` row).
 *   - Count members (seats) — taken from the members list in DB.
 *   - Call `provider.setSubscriptionSeats({ subscriptionId, seats })`.
 *
 * No-op when the org has no active subscription (yet); the next upgrade
 * will start the subscription with the correct seat count.
 *
 * Seat counting is intentionally kept outside this helper: callers pass
 * the final count so tests and the auth hooks stay in control of the
 * source-of-truth query.
 */
export async function updateSeatsInOrganizationSubscription(
	organizationId: string,
	seats: number,
): Promise<void> {
	const provider = resolvePaymentProvider();
	// Skip when the active provider's upstream plugin already owns seat
	// sync (e.g. Better-Auth Polar plugin). Calling again here would race
	// or double-count.
	if (provider.ownsSeatSync) {
		log.debug("skip seats sync — provider owns it", {
			provider: provider.id,
			organizationId,
			seats,
		});
		return;
	}
	const subscription =
		await getActiveSubscriptionForOrganization(organizationId);
	if (!subscription?.subscriptionId) {
		log.info("no active subscription — skipping seat sync", {
			organizationId,
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
 */
export async function cancelAllSubscriptionsForOrganization(
	organizationId: string,
): Promise<void> {
	const purchases = await getPurchasesByOrganizationId(organizationId);
	const provider = resolvePaymentProvider();
	for (const p of purchases) {
		if (p.type !== "SUBSCRIPTION" || !p.subscriptionId) continue;
		if (p.status !== "ACTIVE" && p.status !== "TRIALING") continue;
		try {
			await provider.cancelSubscription(p.subscriptionId);
		} catch (err) {
			log.error("cancelSubscription failed", {
				organizationId,
				subscriptionId: p.subscriptionId,
				err: String(err),
			});
		}
	}
}
