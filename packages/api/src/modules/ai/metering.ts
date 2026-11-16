import { checkCredits, consumeCredits, getMeter } from "@fuutu/credits";
import { createLogger } from "@fuutu/logs";
import { getPlanSubscription } from "@fuutu/payments";
import { paymentsConfig } from "@fuutu/payments/config";
import { ORPCError } from "@orpc/server";

const log = createLogger({ scope: "ai-metering" });

/** The credit meter AI replies are billed on (`@fuutu/credits/meters`). */
export const AI_TOKENS_METER = "ai_tokens";

/**
 * Token estimate: the provider interface streams raw text without usage
 * data, so tokens are estimated as ceil(characters / 4) — the common rule
 * of thumb for English text. A provider that reports usage can replace
 * this with its real counts.
 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
	return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Who pays: the user, or the organization a conversation belongs to. */
export type AiCreditOwner = { userId: string } | { organizationId: string };

const ownerParams = (owner: AiCreditOwner) =>
	"organizationId" in owner
		? { userId: undefined, organizationId: owner.organizationId }
		: { userId: owner.userId, organizationId: undefined };

/** What `assertAiCredits` granted — pass it on to `recordAiUsage`. */
export type AiSpend = { allowOverage: boolean };

/**
 * Overage on the AI meter needs an active paid plan subscription of the
 * paying owner: the free plan and trials stop at their balance.
 */
async function ownerMayOverage(owner: AiCreditOwner): Promise<boolean> {
	if (getMeter(AI_TOKENS_METER)?.allowOverage !== true) return false;
	const subscription = await getPlanSubscription(owner);
	return subscription !== null && subscription.status !== "TRIALING";
}

/**
 * Throws `PAYMENT_REQUIRED` (402, data `{ meterKey }`) when the owner cannot
 * spend `promptTokens` on the AI meter. A meter with `allowOverage` (the
 * kit's `ai_tokens`) lets an owner with an active paid plan go past the
 * balance — recorded as overage; everyone else is blocked at the balance.
 * No-op when credits are disabled.
 */
export async function assertAiCredits(
	owner: AiCreditOwner,
	promptTokens: number,
): Promise<AiSpend> {
	if (!paymentsConfig.creditsEnabled) return { allowOverage: false };
	const allowOverage = await ownerMayOverage(owner);
	const { allowed } = await checkCredits({
		...ownerParams(owner),
		meterKey: AI_TOKENS_METER,
		amount: Math.max(1, promptTokens),
		allowOverage,
	});
	if (!allowed) {
		throw new ORPCError("PAYMENT_REQUIRED", {
			status: 402,
			message: "AI credits exhausted",
			data: { meterKey: AI_TOKENS_METER },
		});
	}
	return { allowOverage };
}

/**
 * Records a finished — or partial — reply: prompt + reply tokens, once per
 * `idempotencyKey`. The prompt is billed even when the reply is empty. A
 * reply that overshoots the balance without overage drains what is left.
 * Never throws: the reply has already been sent, a failed consume is
 * logged instead.
 */
export async function recordAiUsage(
	owner: AiCreditOwner,
	usage: {
		promptTokens: number;
		reply: string;
		idempotencyKey: string;
		reason: string;
		spend: AiSpend;
	},
): Promise<void> {
	if (!paymentsConfig.creditsEnabled) return;
	const amount = Math.max(1, usage.promptTokens + estimateTokens(usage.reply));
	const consume = (tokens: number) =>
		consumeCredits({
			...ownerParams(owner),
			meterKey: AI_TOKENS_METER,
			amount: tokens,
			reason: usage.reason,
			idempotencyKey: usage.idempotencyKey,
			allowOverage: usage.spend.allowOverage,
		});
	try {
		const result = await consume(amount);
		if (!result.ok) {
			log.warn("AI usage exceeded the credit balance", {
				amount,
				remaining: result.remaining,
			});
			if (result.remaining > 0) await consume(result.remaining);
		}
	} catch (err) {
		log.error("Failed to record AI usage", { err, amount });
	}
}
