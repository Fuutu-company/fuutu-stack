import { checkCredits, consumeCredits } from "@fuutu/credits";
import { createLogger } from "@fuutu/logs";
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

/**
 * Throws `PAYMENT_REQUIRED` (402, data `{ meterKey }`) when the owner cannot
 * spend `promptTokens` on the AI meter. A meter with `allowOverage` (the
 * kit's `ai_tokens`) never blocks — usage beyond the balance is recorded as
 * overage. No-op when credits are disabled.
 */
export async function assertAiCredits(
	owner: AiCreditOwner,
	promptTokens: number,
): Promise<void> {
	if (!paymentsConfig.creditsEnabled) return;
	const { allowed } = await checkCredits({
		...ownerParams(owner),
		meterKey: AI_TOKENS_METER,
		amount: Math.max(1, promptTokens),
	});
	if (!allowed) {
		throw new ORPCError("PAYMENT_REQUIRED", {
			status: 402,
			message: "AI credits exhausted",
			data: { meterKey: AI_TOKENS_METER },
		});
	}
}

/**
 * Records a finished — or partial — reply: prompt + reply tokens, once per
 * `idempotencyKey`. Only replies with text are billed. Never throws: the
 * reply has already been sent, a failed consume is logged instead.
 */
export async function recordAiUsage(
	owner: AiCreditOwner,
	usage: {
		promptTokens: number;
		reply: string;
		idempotencyKey: string;
		reason: string;
	},
): Promise<void> {
	if (!paymentsConfig.creditsEnabled || !usage.reply) return;
	const amount = usage.promptTokens + estimateTokens(usage.reply);
	try {
		const result = await consumeCredits({
			...ownerParams(owner),
			meterKey: AI_TOKENS_METER,
			amount,
			reason: usage.reason,
			idempotencyKey: usage.idempotencyKey,
		});
		if (!result.ok) {
			log.warn("AI usage exceeded the credit balance", {
				amount,
				consumed: result.consumed,
			});
		}
	} catch (err) {
		log.error("Failed to record AI usage", { err, amount });
	}
}
