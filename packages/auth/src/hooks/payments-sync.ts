/**
 * Business-logic hooks that keep external payment providers in sync with
 * membership/organization changes inside Better-Auth.
 *
 * Wired from auth hooks; actual provider calls delegate to
 * `@fuutu/payments`. Failures are logged but never propagate —
 * auth flows must not block on payment-provider availability.
 */
import { db, getPurchasesByUserId } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import {
	cancelAllSubscriptionsForOrganization,
	resolvePaymentProvider,
	updateSeatsInOrganizationSubscription,
} from "@fuutu/payments";

const log = createLogger({ scope: "auth:payments-sync" });

/**
 * Recomputes the current member count of the org and syncs it with the
 * payment provider. No-op when the org has no active subscription.
 */
export async function syncSeatsForOrganization(
	organizationId: string,
): Promise<void> {
	try {
		const seats = await db.member.count({ where: { organizationId } });
		await updateSeatsInOrganizationSubscription(organizationId, seats);
	} catch (err) {
		log.error("syncSeatsForOrganization failed", {
			organizationId,
			err: String(err),
		});
	}
}

export async function cancelActiveSubscriptionsForUser(
	userId: string,
): Promise<void> {
	let purchases: Awaited<ReturnType<typeof getPurchasesByUserId>>;
	try {
		purchases = await getPurchasesByUserId(userId);
	} catch (err) {
		log.error("cancelActiveSubscriptionsForUser: load failed", {
			userId,
			err: String(err),
		});
		return;
	}

	const provider = resolvePaymentProvider();
	// `allSettled` so a single provider failure does not leave the rest
	// of the user's subscriptions dangling when the account is deleted.
	const results = await Promise.allSettled(
		purchases
			.filter(
				(p) =>
					p.type === "SUBSCRIPTION" &&
					p.subscriptionId &&
					(p.status === "ACTIVE" || p.status === "TRIALING"),
			)
			.map((p) => provider.cancelSubscription(p.subscriptionId as string)),
	);
	for (const r of results) {
		if (r.status === "rejected") {
			log.error("cancelActiveSubscriptionsForUser: one cancel failed", {
				userId,
				err: String(r.reason),
			});
		}
	}
}

export async function cancelActiveSubscriptionsForOrganization(
	organizationId: string,
): Promise<void> {
	try {
		await cancelAllSubscriptionsForOrganization(organizationId);
	} catch (err) {
		log.error("cancelActiveSubscriptionsForOrganization failed", {
			organizationId,
			err: String(err),
		});
	}
}
