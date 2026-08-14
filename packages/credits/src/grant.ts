import { grantRecurringCreditsTx, grantTopUpCreditsTx } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";

const log = createLogger({ scope: "credits:grant" });

export const GrantRecurringCreditsSchema = z.object({
	userId: z.string().optional(),
	organizationId: z.string().optional(),
	meterKey: z.string(),
	amount: z.number().int().positive(),
	periodEnd: z.date(),
});

export const GrantTopUpCreditsSchema = z.object({
	userId: z.string().optional(),
	organizationId: z.string().optional(),
	meterKey: z.string(),
	amount: z.number().int().positive(),
	expiresAt: z.date().nullable().optional(),
	purchaseId: z.string().nullable().optional(),
	priority: z.number().int().optional(),
});

/**
 * Grant recurring credits to a user or org (called on subscription activation/renewal).
 * Sets the recurringGranted and resets recurringConsumed to 0.
 */
export async function grantRecurringCredits(params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	periodEnd: Date;
}): Promise<void> {
	const { userId, organizationId, meterKey, amount, periodEnd } =
		GrantRecurringCreditsSchema.parse(params);

	await grantRecurringCreditsTx({
		userId,
		organizationId,
		meterKey,
		amount,
		periodEnd,
	});

	log.info("granted recurring credits", {
		userId,
		organizationId,
		meterKey,
		amount,
		periodEnd,
	});
}

/**
 * Grant a one-time top-up package (called on one-time purchase completion).
 * Creates a CreditPackage row.
 */
export async function grantTopUpCredits(params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	expiresAt?: Date | null;
	purchaseId?: string | null;
	priority?: number;
}): Promise<void> {
	const {
		userId,
		organizationId,
		meterKey,
		amount,
		expiresAt,
		purchaseId,
		priority,
	} = GrantTopUpCreditsSchema.parse(params);

	await grantTopUpCreditsTx({
		userId,
		organizationId,
		meterKey,
		amount,
		expiresAt,
		purchaseId,
		priority,
	});

	log.info("granted top-up credits", {
		userId,
		organizationId,
		meterKey,
		amount,
		expiresAt,
	});
}
