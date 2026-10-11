/**
 * Server-only extensions to the payments config.
 *
 * This file imports `@fuutu/env/saas` and must NEVER be imported from a
 * client component. It contains functions that need env-var fallbacks for
 * webhook sync and checkout creation. Client-safe config lives in
 * `./config` — only server-only code imports from `./config.server`.
 */
import { env } from "@fuutu/env/saas";
import {
	CREDIT_TOPUPS,
	type CreditTopupPackage,
	type PlanId,
	PRICE_IDS,
} from "./config";

/**
 * Reverse lookup: given a provider-side product/price ID, find the plan ID.
 * Used by webhook sync to map active subscriptions back to plans.
 *
 * Checks PRICE_IDS first (populated by setPriceIds), then falls back to env
 * vars. This ensures webhook handlers work even if setPriceIds() was never
 * called (e.g. in a pure API context).
 */
export function getPlanIdForProductId(productId: string): PlanId | undefined {
	// Check the runtime-populated map first
	const fromRuntime = (Object.keys(PRICE_IDS) as PlanId[]).find(
		(key) => PRICE_IDS[key] === productId,
	);
	if (fromRuntime) return fromRuntime;

	// Fallback: read validated env vars via @fuutu/env/saas
	if (env.PAYMENTS_PRO_PRICE_ID === productId) return "pro";
	if (env.PAYMENTS_PRO_YEARLY_PRICE_ID === productId) return "pro";

	return undefined;
}

/**
 * Resolve the provider-side price ID for a credit top-up package.
 * Reads from env vars — only callable server-side.
 */
export function getCreditTopupPriceId(topupId: string): string | undefined {
	const topup = CREDIT_TOPUPS.find((t) => t.id === topupId);
	if (!topup) return undefined;

	const envVarMap: Record<string, string | undefined> = {
		CREDITS_AI_TOKENS_100K_PRICE_ID: env.CREDITS_AI_TOKENS_100K_PRICE_ID,
		CREDITS_AI_TOKENS_500K_PRICE_ID: env.CREDITS_AI_TOKENS_500K_PRICE_ID,
		CREDITS_API_CALLS_50K_PRICE_ID: env.CREDITS_API_CALLS_50K_PRICE_ID,
	};
	return envVarMap[topup.priceIdEnvVar];
}

export type { CreditTopupPackage, PlanId };
