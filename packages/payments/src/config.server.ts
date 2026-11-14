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
	return getPlanForProductId(productId)?.planId;
}

/**
 * Plan and billing interval of a provider-side product/price ID — normal
 * and no-trial products (`noTrialPriceIdEnvVars`) alike. Billing UIs get
 * this from the server instead of matching price IDs on the client.
 */
export function getPlanForProductId(
	productId: string,
): { planId: PlanId; interval: "month" | "year" } | undefined {
	for (const planId of PLAN_IDS) {
		const { priceIdEnvVars, noTrialPriceIdEnvVars } = plans[planId];
		for (const vars of [priceIdEnvVars, noTrialPriceIdEnvVars]) {
			for (const interval of ["month", "year"] as const) {
				const key = vars?.[interval];
				if (key && isEnvKey(key) && env[key] === productId) {
					return { planId, interval };
				}
			}
		}
	}
	return undefined;
}

function envValue(key: string | undefined): string | undefined {
	if (!key || !isEnvKey(key)) return undefined;
	const value = env[key];
	return typeof value === "string" && value ? value : undefined;
}

/**
 * The plan's product WITHOUT a trial for `interval`
 * (`PLANS[].noTrialPriceIdEnvVars`), `undefined` when none is configured.
 */
export function getPlanNoTrialPriceId(
	planId: PlanId,
	interval: "month" | "year",
): string | undefined {
	return envValue(plans[planId].noTrialPriceIdEnvVars?.[interval]);
}

/**
 * Resolve the provider-side price/product ID for a plan + billing interval.
 * The env var names are declared per plan in `PLANS[].priceIdEnvVars`
 * (same pattern as `CREDIT_TOPUPS[].priceIdEnvVar`). Returns undefined when
 * the plan has no mapping for the interval or the env var is unset —
 * callers fail closed. `{ trial: false }` prefers the plan's no-trial
 * product (`getPlanNoTrialPriceId`) and falls back to the normal one.
 */
export function getPlanPriceId(
	planId: PlanId,
	interval: "month" | "year",
	opts?: { trial?: boolean },
): string | undefined {
	// No trial: the no-trial product when one is configured.
	if (opts?.trial === false) {
		const noTrial = getPlanNoTrialPriceId(planId, interval);
		if (noTrial) return noTrial;
	}
	const key = plans[planId].priceIdEnvVars?.[interval];
	if (!key || !isEnvKey(key)) return undefined;
	const value = env[key];
	return typeof value === "string" ? value : undefined;
}

/** Provider-side price IDs of a plan, keyed by billing interval. */
export type PlanPriceIds = { monthly?: string; yearly?: string };

/**
 * Price IDs of every plan that has at least one configured (env-set) ID —
 * what the billing pages pass to their client components. Plans come from
 * `PLANS[].priceIdEnvVars`, so a new plan needs no page change.
 */
export function getPlanPriceIds(): Partial<Record<PlanId, PlanPriceIds>> {
	const result: Partial<Record<PlanId, PlanPriceIds>> = {};
	for (const planId of PLAN_IDS) {
		const monthly = getPlanPriceId(planId, "month");
		const yearly = getPlanPriceId(planId, "year");
		if (monthly || yearly) result[planId] = { monthly, yearly };
	}
	return result;
}

/**
 * Provider-side price/product IDs of every `billingType: "one_time"` plan
 * (all intervals, unset env vars skipped; add-ons excluded). An active
 * one-time purchase of one of these grants its plan for life — see
 * `getActivePlanId`.
 */
export function getOneTimePlanPriceIds(): string[] {
	const ids: string[] = [];
	for (const planId of PLAN_IDS) {
		const plan = plans[planId];
		// An add-on (`addonOf`) never stands for a plan — not even for life.
		if (plan.billingType !== "one_time" || plan.addonOf) continue;
		for (const key of Object.values(plan.priceIdEnvVars ?? {})) {
			if (!isEnvKey(key)) continue;
			const value = env[key];
			if (typeof value === "string" && value) ids.push(value);
		}
	}
	return ids;
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
