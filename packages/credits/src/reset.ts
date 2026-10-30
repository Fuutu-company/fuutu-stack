import { resetRecurringBalancesTx } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";
import { getMeter } from "./meters";
import { ownerXorCheck } from "./owner";

const log = createLogger({ scope: "credits:reset" });

export const ResetRecurringCreditsSchema = ownerXorCheck(
	z.object({
		userId: z.string().optional(),
		organizationId: z.string().optional(),
		newPeriodEnd: z.date(),
		newGranted: z
			.record(z.string(), z.number().int().nonnegative().max(2_147_483_647))
			.optional(),
	}),
);

/**
 * Reset recurring balances for a new billing period.
 * Called on subscription.renewed webhook or by a cron job.
 *
 * The balance fetch happens inside resetRecurringBalancesTx's transaction
 * (no TOCTOU between read and write) and all resets commit or roll back
 * together.
 */
export async function resetRecurringCredits(params: {
	userId?: string;
	organizationId?: string;
	newPeriodEnd: Date;
	newGranted?: Record<string, number>; // meterKey -> new amount (if plan changed)
}): Promise<void> {
	const { userId, organizationId, newPeriodEnd, newGranted } =
		ResetRecurringCreditsSchema.parse(params);

	for (const meterKey of Object.keys(newGranted ?? {})) {
		if (!getMeter(meterKey)) {
			throw new Error(`resetRecurringCredits: unknown meter key "${meterKey}"`);
		}
	}

	const balances = await resetRecurringBalancesTx({
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
