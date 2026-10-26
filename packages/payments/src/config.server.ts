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
	PLAN_IDS,
	PLANS,
	type Plan,
	type PlanId,
} from "./config";

// PLANS is `as const` — per-plan literal shapes only carry the keys they
// declare, so `priceIdEnvVars` lookups need the widened Record view.
const plans: Record<PlanId, Plan> = PLANS;

const isEnvKey = (key: string): key is keyof typeof env => key in env;

/**
 * Reverse lookup: given a provider-side product/price ID, find the plan ID.
 * Used by webhook sync to map active subscriptions back to plans.
 *
 * Reads the validated env vars via @fuutu/env/saas — sandbox and
 * production carry different price IDs, so they never live in code.
 * The env var names are declared per plan in `PLANS[].priceIdEnvVars`.
 */
export function getPlanIdForProductId(productId: string): PlanId | undefined {
	for (const planId of PLAN_IDS) {
		for (const key of Object.values(plans[planId].priceIdEnvVars ?? {})) {
			if (isEnvKey(key) && env[key] === productId) {
				return planId;
			}
		}
	}
	return undefined;
}

/**
 * Resolve the provider-side price/product ID for a plan + billing interval.
 * The env var names are declared per plan in `PLANS[].priceIdEnvVars`
 * (same pattern as `CREDIT_TOPUPS[].priceIdEnvVar`). Returns undefined when
 * the plan has no mapping for the interval or the env var is unset —
 * callers fail closed.
 */
export function getPlanPriceId(
	planId: PlanId,
	interval: "month" | "year",
): string | undefined {
	const key = plans[planId].priceIdEnvVars?.[interval];
	if (!key || !isEnvKey(key)) return undefined;
	const value = env[key];
	return typeof value === "string" ? value : undefined;
}

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
