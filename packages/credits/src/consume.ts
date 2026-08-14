import {
	consumeCreditsTx,
	getActiveCreditPackages,
	getCreditBalance as getBalance,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { getMeter } from "@fuutu/payments/config";
import { z } from "zod";

const log = createLogger({ scope: "credits" });

export const ConsumeCreditsSchema = z.object({
	userId: z.string().optional(),
	organizationId: z.string().optional(),
	meterKey: z.string(),
	amount: z.number().int().positive(),
	reason: z.string(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

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
	const { userId, organizationId, meterKey, amount, reason, metadata } =
		ConsumeCreditsSchema.parse(params);

	if (!userId && !organizationId) {
		throw new Error(
			"consumeCredits: either userId or organizationId must be set",
		);
	}

	const meter = getMeter(meterKey);
	if (!meter) {
		throw new Error(`consumeCredits: unknown meter key "${meterKey}"`);
	}

	const result = await consumeCreditsTx({
		userId,
		organizationId,
		meterKey,
		amount,
		reason,
		metadata,
		allowOverage: meter.allowOverage ?? false,
	});

	if (result.ok) {
		log.info("consumed credits", {
			meterKey,
			amount,
			source: result.source,
			remaining: result.remaining,
		});
	} else {
		log.warn("credits exceeded", {
			meterKey,
			requested: amount,
			consumed: result.consumed,
			remaining: result.remaining,
		});
	}

	return result;
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
	const topupRemaining = packages.reduce(
		(sum: number, p: { remaining: number }) => sum + p.remaining,
		0,
	);
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
