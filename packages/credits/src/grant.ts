import { createCreditEvent, upsertCreditBalance } from "@fuutu/db";
import { createLogger } from "@fuutu/logs";

const log = createLogger({ scope: "credits:grant" });

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
	const { userId, organizationId, meterKey, amount, periodEnd } = params;

	await upsertCreditBalance({
		userId: userId ?? null,
		organizationId: organizationId ?? null,
		meterKey,
		recurringGranted: amount,
		recurringConsumed: 0,
		recurringPeriodEnd: periodEnd,
	});

	await createCreditEvent({
		userId: userId ?? null,
		organizationId: organizationId ?? null,
		meterKey,
		amount,
		source: "admin_grant",
		reason: "subscription_grant",
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
	} = params;

	// Import here to avoid circular dependency at module load
	const { createCreditPackage } = await import("@fuutu/db");

	await createCreditPackage({
		userId: userId ?? null,
		organizationId: organizationId ?? null,
		meterKey,
		amount,
		expiresAt: expiresAt ?? null,
		purchaseId: purchaseId ?? null,
		priority: priority ?? 10,
	});

	await createCreditEvent({
		userId: userId ?? null,
		organizationId: organizationId ?? null,
		meterKey,
		amount,
		source: "admin_grant",
		reason: "topup_purchase",
	});

	log.info("granted top-up credits", {
		userId,
		organizationId,
		meterKey,
		amount,
		expiresAt,
	});
}
