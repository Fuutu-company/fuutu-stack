import {
	createCreditEvent,
	getCreditBalancesForOrganization,
	getCreditBalancesForUser,
	resetRecurringBalance,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";

const log = createLogger({ scope: "credits:reset" });

/**
 * Reset recurring balances for a new billing period.
 * Called on subscription.renewed webhook or by a cron job.
 */
export async function resetRecurringCredits(params: {
	userId?: string;
	organizationId?: string;
	newPeriodEnd: Date;
	newGranted?: Record<string, number>; // meterKey -> new amount (if plan changed)
}): Promise<void> {
	const { userId, organizationId, newPeriodEnd, newGranted } = params;

	const balances = userId
		? await getCreditBalancesForUser(userId)
		: organizationId
			? await getCreditBalancesForOrganization(organizationId)
			: [];

	for (const balance of balances) {
		const newAmount = newGranted?.[balance.meterKey];
		await resetRecurringBalance(balance.id, newPeriodEnd, newAmount);
		await createCreditEvent({
			userId: userId ?? null,
			organizationId: organizationId ?? null,
			meterKey: balance.meterKey,
			amount: 0,
			source: "reset",
			reason: "period_reset",
		});
		log.info("reset recurring balance", {
			meterKey: balance.meterKey,
			newPeriodEnd,
			newAmount,
		});
	}
}
