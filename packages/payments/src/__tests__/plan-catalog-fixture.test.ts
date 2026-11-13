import { planCatalogFixture } from "@fuutu/test-utils";
import { describe, expect, it } from "vitest";
import type {
	CreditTopupPackage,
	FeatureEntry,
	LimitValue,
	Plan,
} from "../config";

/**
 * The kit test fixture (`@fuutu/test-utils`) must keep the shape of the
 * kit's catalog types — the `satisfies` checks below fail `check-types`
 * on drift (a renamed or retyped Plan field, a new required one). They
 * live here because test-utils must not depend on @fuutu/payments.
 *
 * Deliberately loose where apps customise the catalog: tier names
 * (`TIER_ORDER`) and limit keys (`PlanLimits`) are app-owned, so the
 * fixture is checked against `string` / `LimitValue` there — otherwise
 * renaming a tier or adding a limit in the app would break the kit suites.
 */
type FixturePlan = Omit<Plan, "tier"> & { tier?: string };
type FixtureFeature = Omit<FeatureEntry, "tier" | "limitKey"> & {
	tier: string;
	limitKey?: string;
};

const typed = {
	PLANS: planCatalogFixture.PLANS satisfies Record<string, FixturePlan>,
	LIMITS: planCatalogFixture.LIMITS satisfies Record<
		string,
		Record<string, LimitValue>
	>,
	CREDITS: planCatalogFixture.CREDITS satisfies Record<
		string,
		Record<string, LimitValue>
	>,
	CREDIT_TOPUPS:
		planCatalogFixture.CREDIT_TOPUPS satisfies readonly CreditTopupPackage[],
	FEATURE_CATALOG: planCatalogFixture.FEATURE_CATALOG satisfies Record<
		string,
		Record<string, FixtureFeature>
	>,
	TIER_ORDER: planCatalogFixture.TIER_ORDER satisfies readonly string[],
};

describe("planCatalogFixture", () => {
	it("covers every fixture plan in LIMITS and CREDITS", () => {
		const ids = Object.keys(typed.PLANS);
		expect(ids).toEqual(["free", "pro", "enterprise"]);
		expect(Object.keys(typed.LIMITS)).toEqual(ids);
		expect(Object.keys(typed.CREDITS)).toEqual(ids);
		expect(planCatalogFixture.PLAN_IDS).toEqual(ids);
	});

	it("declares every plan tier in its TIER_ORDER", () => {
		for (const plan of Object.values(typed.PLANS)) {
			expect(typed.TIER_ORDER).toContain(plan.tier);
		}
	});
});
