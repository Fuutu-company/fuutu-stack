import {
	getActiveSubscriptionForOrganization,
	getPurchasesByOrganizationId,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { resolvePaymentProvider } from "./resolve";
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
