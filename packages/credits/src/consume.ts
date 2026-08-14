import {
	consumeFromCreditPackage,
	createCreditEvent,
	getActiveCreditPackages,
	getCreditBalance as getBalance,
	incrementRecurringConsumed,
	upsertCreditBalance,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { getMeter } from "@fuutu/payments/config";

const log = createLogger({ scope: "credits" });

export interface ConsumeCreditsParams {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	reason: string;
	metadata?: Record<string, unknown>;
}

export interface ConsumeCreditsResult {
	ok: boolean;
	consumed: number;
	remaining: number;
	source: "recurring" | "topup" | "overage";
	error?: "credits_exceeded";
}

/**
 * Consume credits from the balance.
 *
 * Consumption order:
 * 1. Recurring (monthly) balance — until exhausted
 * 2. Top-up packages — oldest/lowest-priority first, until exhausted
 * 3. Overage — only if meter.allowOverage is true
 * 4. If none of the above: return { ok: false, error: "credits_exceeded" }
 */
export async function consumeCredits(
	params: ConsumeCreditsParams,
): Promise<ConsumeCreditsResult> {
	const { userId, organizationId, meterKey, amount, reason, metadata } = params;

	if (!userId && !organizationId) {
		throw new Error(
			"consumeCredits: either userId or organizationId must be set",
		);
	}

	const meter = getMeter(meterKey);
	if (!meter) {
		throw new Error(`consumeCredits: unknown meter key "${meterKey}"`);
	}

	// 1. Get or create the balance
	let balance = await getBalance({ userId, organizationId, meterKey });
	if (!balance) {
		// No balance exists — create one with 0 granted (user has no subscription credits)
		balance = await upsertCreditBalance({
			userId: userId ?? null,
			organizationId: organizationId ?? null,
			meterKey,
			recurringGranted: 0,
			recurringConsumed: 0,
			recurringPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
		});
	}

	const recurringRemaining =
		balance.recurringGranted - balance.recurringConsumed;
	let remainingToConsume = amount;
	let totalRemaining = 0;

	// 2. Consume from recurring first
	if (recurringRemaining > 0 && remainingToConsume > 0) {
		const fromRecurring = Math.min(recurringRemaining, remainingToConsume);
		await incrementRecurringConsumed(balance.id, fromRecurring);
		await createCreditEvent({
			userId: userId ?? null,
			organizationId: organizationId ?? null,
			meterKey,
			amount: fromRecurring,
			source: "recurring",
			reason,
			metadata: metadata ?? null,
		});
		remainingToConsume -= fromRecurring;
		log.info("consumed from recurring", {
			meterKey,
			amount: fromRecurring,
			remaining: recurringRemaining - fromRecurring,
		});
	}

	// 3. If still need more, consume from top-up packages
	if (remainingToConsume > 0) {
		const packages = await getActiveCreditPackages({
			userId,
			organizationId,
			meterKey,
		});
		for (const pkg of packages) {
			if (remainingToConsume <= 0) break;
			const fromPkg = Math.min(pkg.remaining, remainingToConsume);
			await consumeFromCreditPackage(pkg.id, fromPkg);
			await createCreditEvent({
				userId: userId ?? null,
				organizationId: organizationId ?? null,
				meterKey,
				amount: fromPkg,
				source: "topup",
				packageId: pkg.id,
				reason,
				metadata: metadata ?? null,
			});
			remainingToConsume -= fromPkg;
			log.info("consumed from topup package", {
				meterKey,
				packageId: pkg.id,
				amount: fromPkg,
			});
		}
	}

	// 4. If still need more and overage is allowed
	if (remainingToConsume > 0 && meter.allowOverage) {
		await incrementRecurringConsumed(balance.id, remainingToConsume);
		await createCreditEvent({
			userId: userId ?? null,
			organizationId: organizationId ?? null,
			meterKey,
			amount: remainingToConsume,
			source: "overage",
			reason,
			metadata: metadata ?? null,
		});
		log.warn("consumed as overage", { meterKey, amount: remainingToConsume });
		remainingToConsume = 0;
	}

	// 5. If still need more and no overage — fail
	if (remainingToConsume > 0) {
		// Calculate total remaining for the response
		const finalBalance = await getBalance({
			userId,
			organizationId,
			meterKey,
		});
		const finalRecurring = finalBalance
			? finalBalance.recurringGranted - finalBalance.recurringConsumed
			: 0;
		const packages = await getActiveCreditPackages({
			userId,
			organizationId,
			meterKey,
		});
		const finalTopup = packages.reduce((sum, p) => sum + p.remaining, 0);
		return {
			ok: false,
			consumed: amount - remainingToConsume,
			remaining: Math.max(0, finalRecurring) + finalTopup,
			source: "recurring",
			error: "credits_exceeded",
		};
	}

	// Success — calculate total remaining
	const finalBalance = await getBalance({ userId, organizationId, meterKey });
	const finalRecurring = finalBalance
		? finalBalance.recurringGranted - finalBalance.recurringConsumed
		: 0;
	const packages = await getActiveCreditPackages({
		userId,
		organizationId,
		meterKey,
	});
	const finalTopup = packages.reduce((sum, p) => sum + p.remaining, 0);
	totalRemaining = Math.max(0, finalRecurring) + finalTopup;

	return {
		ok: true,
		consumed: amount,
		remaining: totalRemaining,
		source: recurringRemaining >= amount ? "recurring" : "topup",
	};
}

/**
 * Check if credits can be consumed without actually consuming them.
 */
export async function checkCredits(params: {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
}): Promise<{
	allowed: boolean;
	remaining: number;
	wouldUseTopup: boolean;
}> {
	const { userId, organizationId, meterKey, amount } = params;
	const meter = getMeter(meterKey);
	if (!meter) throw new Error(`checkCredits: unknown meter key "${meterKey}"`);

	const balance = await getBalance({ userId, organizationId, meterKey });
	const recurringRemaining = balance
		? Math.max(0, balance.recurringGranted - balance.recurringConsumed)
		: 0;
	const packages = await getActiveCreditPackages({
		userId,
		organizationId,
		meterKey,
	});
	const topupRemaining = packages.reduce((sum, p) => sum + p.remaining, 0);
	const totalRemaining = recurringRemaining + topupRemaining;

	if (totalRemaining >= amount) {
		return {
			allowed: true,
			remaining: totalRemaining - amount,
			wouldUseTopup: recurringRemaining < amount,
		};
	}
	if (meter.allowOverage) {
		return {
			allowed: true,
			remaining: totalRemaining - amount,
			wouldUseTopup: recurringRemaining < amount,
		};
	}
	return { allowed: false, remaining: totalRemaining, wouldUseTopup: false };
}
