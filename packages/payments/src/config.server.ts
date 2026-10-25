/**
 * Server-only extensions to the payments config.
 *
 * This file imports `@fuutu/env/saas` and must NEVER be imported from a
 * client component. It contains functions that need env-var fallbacks for
 * webhook sync and checkout creation. Client-safe config lives in
 * `./config` — only server-only code imports from `./config.server`.
 */
import { env } from "@fuutu/env/saas";
import { CREDIT_TOPUPS, type CreditTopupPackage, type PlanId } from "./config";

/**
 * Reverse lookup: given a provider-side product/price ID, find the plan ID.
 * Used by webhook sync to map active subscriptions back to plans.
 *
 * Reads the validated env vars via @fuutu/env/saas — sandbox and
 * production carry different price IDs, so they never live in code.
 */
export function getPlanIdForProductId(productId: string): PlanId | undefined {
	if (env.PAYMENTS_PRO_PRICE_ID === productId) return "pro";
	if (env.PAYMENTS_PRO_YEARLY_PRICE_ID === productId) return "pro";

	return undefined;
}

const isEnvKey = (key: string): key is keyof typeof env => key in env;

/**
 * Resolve the provider-side price ID for a credit top-up package.
 * The env var name is declared per package in `CREDIT_TOPUPS[].priceIdEnvVar`
 * and read from the validated env object — only callable server-side.
 */
export function getCreditTopupPriceId(topupId: string): string | undefined {
	const topup = CREDIT_TOPUPS.find((t) => t.id === topupId);
	if (!topup) return undefined;

	const key: string = topup.priceIdEnvVar;
	if (!isEnvKey(key)) return undefined;
	const value = env[key];
	return typeof value === "string" ? value : undefined;
}

export type { CreditTopupPackage, PlanId };
