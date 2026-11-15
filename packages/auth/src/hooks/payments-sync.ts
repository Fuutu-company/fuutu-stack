/**
 * Business-logic hooks that keep external payment providers in sync with
 * membership/organization changes inside Better-Auth.
 *
 * Wired from auth hooks; actual provider calls delegate to
 * `@fuutu/payments`. Failures are logged but never propagate —
 * auth flows must not block on payment-provider availability. Only the
 * `…OrThrow` cancel variants (support deletes) throw.
 */
import { countOrganizationMembers, getPurchasesByUserId } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import {
	cancelAllSubscriptionsForOrganization,
	resolvePaymentProviderById,
	updateSeatsInOrganizationSubscription,
} from "@fuutu/payments";
import { paymentsConfig } from "@fuutu/payments/config";

const log = createLogger({ scope: "auth:payments-sync" });

type UserPurchase = Awaited<ReturnType<typeof getPurchasesByUserId>>[number];

/**
 * Recomputes the current member count of the org and syncs it with the
 * payment provider. No-op when the org has no active subscription or
 * `paymentsConfig.seatSync` is "none".
 */
export async function syncSeatsForOrganization(
	organizationId: string,
): Promise<void> {
	if (paymentsConfig.seatSync === "none") return;
	try {
		const seats = await countOrganizationMembers(organizationId);
		await updateSeatsInOrganizationSubscription(organizationId, seats);
	} catch (err) {
		log.error("syncSeatsForOrganization failed", {
			organizationId,
			err: String(err),
		});
	}
}

/**
 * Thrown by the `…OrThrow` variants: at least one subscription is still
 * billing (provider rejected, provider unavailable or purchases
 * unreadable). Details are logged; the message stays generic.
 */
export class SubscriptionCancellationError extends Error {
	constructor(message = "Subscriptions could not be cancelled") {
		super(message);
		this.name = "SubscriptionCancellationError";
	}
}

/**
 * Cancels the user's active subscriptions, each through the provider it
 * was created with. Returns how many could not be cancelled; throws only
 * when the purchases cannot be read.
 */
async function cancelUserSubscriptions(userId: string): Promise<number> {
	const purchases = await getPurchasesByUserId(userId);

	// Each subscription is cancelled through the provider it was created
	// with — never through whichever provider is active now. `allSettled` so
	// a single provider failure does not leave the rest dangling.
	let failed = 0;
	const results = await Promise.allSettled(
		purchases
			.filter(
				(p): p is UserPurchase & { subscriptionId: string } =>
					p.type === "SUBSCRIPTION" &&
					p.subscriptionId != null &&
					(p.status === "ACTIVE" || p.status === "TRIALING"),
			)
			.map((p) => {
				const provider = resolvePaymentProviderById(p.provider);
				if (!provider) {
					failed++;
					log.warn(
						"cancelActiveSubscriptionsForUser: unknown provider, cancel it manually",
						{
							userId,
							provider: p.provider,
							subscriptionId: p.subscriptionId,
						},
					);
					return Promise.resolve();
				}
				return provider.cancelSubscription(p.subscriptionId, {
					mode: "immediate",
				});
			}),
	);
	for (const r of results) {
		if (r.status === "rejected") {
			failed++;
			log.error("cancelActiveSubscriptionsForUser: one cancel failed", {
				userId,
				err: String(r.reason),
			});
		}
	}
	return failed;
}

/** Hook variant (user delete): failures are logged, never thrown. */
export async function cancelActiveSubscriptionsForUser(
	userId: string,
): Promise<void> {
	try {
		await cancelUserSubscriptions(userId);
	} catch (err) {
		log.error("cancelActiveSubscriptionsForUser: load failed", {
			userId,
			err: String(err),
		});
	}
}

/**
 * Strict variant for support deletes: tries every cancel, then throws
 * `SubscriptionCancellationError` if any subscription is still billing.
 */
export async function cancelActiveSubscriptionsForUserOrThrow(
	userId: string,
): Promise<void> {
	let failed: number;
	try {
		failed = await cancelUserSubscriptions(userId);
	} catch (err) {
		log.error("cancelActiveSubscriptionsForUser: load failed", {
			userId,
			err: String(err),
		});
		throw new SubscriptionCancellationError();
	}
	if (failed > 0) throw new SubscriptionCancellationError();
}

/** Hook variant (`beforeDeleteOrganization`): failures are logged, never thrown. */
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

/**
 * Strict variant for support deletes: throws
 * `SubscriptionCancellationError` if any subscription is still billing.
 */
export async function cancelActiveSubscriptionsForOrganizationOrThrow(
	organizationId: string,
): Promise<void> {
	try {
		await cancelAllSubscriptionsForOrganization(organizationId, {
			failOnError: true,
		});
	} catch (err) {
		log.error("cancelActiveSubscriptionsForOrganization failed", {
			organizationId,
			err: String(err),
		});
		throw new SubscriptionCancellationError();
	}
}
