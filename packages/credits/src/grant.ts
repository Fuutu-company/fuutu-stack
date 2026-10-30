import { grantRecurringCreditsTx, grantTopUpCreditsTx } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";
import { getMeter } from "./meters";
import { ownerXorCheck } from "./owner";

const log = createLogger({ scope: "credits:grant" });

export const GrantRecurringCreditsSchema = ownerXorCheck(
	z.object({
		userId: z.string().optional(),
		organizationId: z.string().optional(),
		meterKey: z.string().min(1),
		amount: z.number().int().positive().max(2_147_483_647),
		periodEnd: z.date(),
	}),
);

export const GrantTopUpCreditsSchema = ownerXorCheck(
	z.object({
		userId: z.string().optional(),
		organizationId: z.string().optional(),
		meterKey: z.string().min(1),
		amount: z.number().int().positive().max(2_147_483_647),
		expiresAt: z
			.date()
			.nullable()
			.optional()
			.refine((d) => d == null || d.getTime() > Date.now(), {
				message: "expiresAt must be in the future",
			}),
		purchaseId: z.string().min(1).nullable().optional(),
		priority: z
			.number()
			.int()
			.min(-2_147_483_648)
			.max(2_147_483_647)
			.optional(),
	}),
);

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

	if (!getMeter(meterKey)) {
		throw new Error(`grantRecurringCredits: unknown meter key "${meterKey}"`);
	}

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

	if (!getMeter(meterKey)) {
		throw new Error(`grantTopUpCredits: unknown meter key "${meterKey}"`);
	}

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
