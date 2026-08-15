import {
	getCreditBalancesForOrganization,
	getCreditBalancesForUser,
	resetRecurringBalancesTx,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";

const log = createLogger({ scope: "credits:reset" });

export const ResetRecurringCreditsSchema = z.object({
	userId: z.string().optional(),
	organizationId: z.string().optional(),
	newPeriodEnd: z.date(),
	newGranted: z.record(z.string(), z.number().int().positive()).optional(),
});

/**
 * Reset recurring balances for a new billing period.
 * Called on subscription.renewed webhook or by a cron job.
 *
 * Wrapped in a single transaction to ensure all resets succeed or fail together.
 */
export async function resetRecurringCredits(params: {
	userId?: string;
	organizationId?: string;
	newPeriodEnd: Date;
	newGranted?: Record<string, number>; // meterKey -> new amount (if plan changed)
}): Promise<void> {
	const { userId, organizationId, newPeriodEnd, newGranted } =
		ResetRecurringCreditsSchema.parse(params);

	const balances = userId
		? await getCreditBalancesForUser(userId)
		: organizationId
			? await getCreditBalancesForOrganization(organizationId)
			: [];

	await resetRecurringBalancesTx({
		balances,
		userId,
		organizationId,
		newPeriodEnd,
		newGranted,
	});

	for (const balance of balances) {
		log.info("reset recurring balance", {
			meterKey: balance.meterKey,
			newPeriodEnd,
			newAmount: newGranted?.[balance.meterKey],
		});
	}
}
