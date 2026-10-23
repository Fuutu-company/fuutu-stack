import {
	consumeCreditsTx,
	getActiveCreditPackages,
	getCreditBalance as getBalance,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";
import { z } from "zod";
import { getMeter } from "./meters";
import { ownerXorCheck } from "./owner";

const log = createLogger({ scope: "credits" });

export const ConsumeCreditsSchema = ownerXorCheck(
	z.object({
		userId: z.string().optional(),
		organizationId: z.string().optional(),
		meterKey: z.string().min(1),
		amount: z.number().int().positive().max(2_147_483_647),
		reason: z.string(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		idempotencyKey: z.string().min(1).max(255).optional(),
	}),
);

export interface ConsumeCreditsParams {
	userId?: string;
	organizationId?: string;
	meterKey: string;
	amount: number;
	reason: string;
	metadata?: Record<string, unknown>;
	idempotencyKey?: string;
}

export interface ConsumeCreditsResult {
	ok: boolean;
	consumed: number;
	remaining: number;
	source: "recurring" | "topup" | "overage";
	error?: "credits_exceeded";
	deduplicated?: boolean;
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
	const {
		userId,
		organizationId,
		meterKey,
		amount,
		reason,
		metadata,
		idempotencyKey,
	} = ConsumeCreditsSchema.parse(params);

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
		idempotencyKey,
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

export const CheckCreditsSchema = ownerXorCheck(
	z.object({
		userId: z.string().optional(),
		organizationId: z.string().optional(),
		meterKey: z.string().min(1),
		amount: z.number().int().positive().max(2_147_483_647),
	}),
);

/**
 * Check if credits can be consumed without actually consuming them.
 *
 * This is a best-effort check for UI/display purposes. The actual consumeCredits
 * function performs its own transactional validation, so a stale read here is not
 * a security issue — it may only show outdated information to the user.
 */
export async function checkCredits(
	params: z.infer<typeof CheckCreditsSchema>,
): Promise<{
	allowed: boolean;
	remaining: number;
	wouldUseTopup: boolean;
}> {
	const { userId, organizationId, meterKey, amount } =
		CheckCreditsSchema.parse(params);
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
		(sum: number, p) => sum + (p.amount - p.consumed),
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
