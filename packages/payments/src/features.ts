/**
 * Feature helpers for plan gates and pricing display.
 * To add/remove features or change tiers: edit FEATURE_CATALOG in ./config.
 */

import {
	FEATURE_CATALOG,
	type FeatureEntry,
	LIMITS,
	type LimitValue,
	PLANS,
	type PlanId,
	type PlanTier,
	TIER_ORDER,
} from "./config";

export type { FeatureEntry, LimitValue, PlanTier };

export type FeatureGroup = keyof typeof FEATURE_CATALOG;

export type LimitKey = keyof typeof LIMITS.free;

export { FEATURE_CATALOG };

export const FEATURE_GROUPS = Object.keys(FEATURE_CATALOG) as FeatureGroup[];

// ─── Internal flat representation (used by helpers below) ─────────────────────

export interface CatalogFeature {
	id: string;
	group: FeatureGroup;
	tier: PlanTier;
	limitKey?: LimitKey;
}

function toFlatCatalog(): CatalogFeature[] {
	return (
		Object.entries(FEATURE_CATALOG) as [
			FeatureGroup,
			Record<string, FeatureEntry>,
		][]
	).flatMap(([group, entries]) =>
		Object.entries(entries)
			.filter(([, e]) => !e.hidden)
			.map(([key, e]) => ({
				id: `${group}_${key}`,
				group,
				tier: e.tier,
				limitKey: e.limitKey,
			})),
	);
}

const FLAT_CATALOG = toFlatCatalog();

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function planIdToTier(planId: PlanId): PlanTier {
	// Plans without a declared tier count as "free" — same as before tiers
	// were declared on the plan, so existing custom plans keep working.
	return (PLANS[planId] as { tier?: PlanTier } | undefined)?.tier ?? "free";
}

export function getFeaturesForTier(tier: PlanTier): CatalogFeature[] {
	const maxIdx = TIER_ORDER.indexOf(tier);
	return FLAT_CATALOG.filter((f) => TIER_ORDER.indexOf(f.tier) <= maxIdx);
}

export function getPricingFeaturesForPlan(planId: PlanId): CatalogFeature[] {
	return getFeaturesForTier(planIdToTier(planId));
}

export function getLimit(planId: PlanId, limitKey: LimitKey): LimitValue {
	return LIMITS[planId][limitKey];
}

export function formatLimit(value: LimitValue): string {
	if (value === false) return "—";
	if (value === "unlimited") return "∞";
	return String(value);
}
