/**
 * Plan resolution + limit enforcement helpers.
 *
 * Server-only — imports from config.server for product-ID → plan-ID mapping.
 * Used by the `authorize()` middleware in @fuutu/api.
 */

import { PLANS, type PlanId, type PlanTier } from "./config";
import { getPlanIdForProductId } from "./config.server";
import {
	getLimit,
	type LimitKey,
	type LimitValue,
	planIdToTier,
} from "./features";

export type ResolvedPlan = {
	planId: PlanId;
	tier: PlanTier;
};

const TIER_ORDER: PlanTier[] = ["free", "pro", "enterprise"];

/**
 * Resolve the active plan for a user or organization.
 * Falls back to "free" when no active subscription exists.
 *
 * Uses getActivePlanId (from sync.ts) which queries the DB for the
 * active purchase, then maps the product/price ID back to a PlanId.
 */
export async function resolveActivePlan(
	userId?: string | null,
	organizationId?: string | null,
): Promise<ResolvedPlan> {
	const { getActivePlanId } = await import("./sync");
	const productId = await getActivePlanId(userId, organizationId);
	if (!productId) return { planId: "free", tier: "free" };
	const planId = getPlanIdForProductId(productId);
	if (!planId || !(planId in PLANS)) return { planId: "free", tier: "free" };
	return { planId, tier: planIdToTier(planId) };
}

/**
 * Check whether the current plan tier meets the required minimum.
 */
export function meetsTier(current: PlanTier, required: PlanTier): boolean {
	return TIER_ORDER.indexOf(current) >= TIER_ORDER.indexOf(required);
}

/**
 * Get the limit value for a plan + limit key.
 * Returns the raw LimitValue (number | "unlimited" | false).
 */
export function getPlanLimit(planId: PlanId, key: LimitKey): LimitValue {
	return getLimit(planId, key);
}

/**
 * Check a current count against a plan limit.
 *
 * Returns:
 *  - { ok: true } if within limit
 *  - { ok: false, reason: "feature-not-available" } if limit is `false`
 *  - { ok: false, reason: "limit-exceeded", limit, current } if count >= limit
 */
export type LimitCheckResult =
	| { ok: true }
	| { ok: false; reason: "feature-not-available" }
	| { ok: false; reason: "limit-exceeded"; limit: number; current: number };

export function checkLimit(
	limit: LimitValue,
	currentCount: number,
): LimitCheckResult {
	if (limit === false) return { ok: false, reason: "feature-not-available" };
	if (limit === "unlimited") return { ok: true };
	if (currentCount >= limit) {
		return {
			ok: false,
			reason: "limit-exceeded",
			limit,
			current: currentCount,
		};
	}
	return { ok: true };
}
