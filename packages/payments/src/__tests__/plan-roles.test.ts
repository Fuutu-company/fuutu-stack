import { describe, expect, it, vi } from "vitest";

/**
 * Plan roles the kit UI derives from the catalog instead of plan-id
 * literals: the seat-priced plan (seat selector) and the free fallback
 * plan (orgs without a subscription). Run against an app-shaped catalog
 * with none of the kit ids, so a renamed catalog keeps working.
 */

const APP_PLANS = {
	starter: {
		tier: "free",
		amount: 0,
		currency: "eur",
		billingType: "free",
		displayPrice: "€0",
		showInSaas: true,
		showInMarketing: true,
	},
	solo: {
		tier: "pro",
		amount: 900,
		currency: "eur",
		billingType: "subscription",
		interval: "month",
		displayPrice: "€9",
		showInSaas: true,
		showInMarketing: true,
	},
	team: {
		tier: "pro",
		amount: 2900,
		currency: "eur",
		billingType: "subscription",
		interval: "year",
		seatBased: true,
		displayPrice: "€29",
		showInSaas: true,
		showInMarketing: true,
	},
	scale: {
		tier: "enterprise",
		amount: -1,
		currency: "eur",
		billingType: "custom",
		displayPrice: "—",
		showInSaas: false,
		showInMarketing: true,
	},
};

const catalog = vi.hoisted(() => ({ plans: {} as Record<string, unknown> }));

vi.mock("../config", async (importOriginal) => ({
	...(await importOriginal<typeof import("../config")>()),
	get PLANS() {
		return catalog.plans;
	},
	get PLAN_IDS() {
		return Object.keys(catalog.plans);
	},
}));

const { getFreePlanId, getSeatPlan, getShowcasePlan } = await import(
	"../plans"
);

describe("getSeatPlan()", () => {
	it("returns the first seat-based plan with its id", () => {
		catalog.plans = APP_PLANS;
		expect(getSeatPlan()).toEqual({ id: "team", plan: APP_PLANS.team });
	});

	it("returns undefined when no plan is seat-based", () => {
		const { team: _team, ...rest } = APP_PLANS;
		catalog.plans = rest;
		expect(getSeatPlan()).toBeUndefined();
	});
});

describe("getFreePlanId()", () => {
	it("returns the first free-billing plan", () => {
		catalog.plans = APP_PLANS;
		expect(getFreePlanId()).toBe("starter");
	});

	it("returns undefined for a catalog without a free plan", () => {
		const { starter: _starter, ...rest } = APP_PLANS;
		catalog.plans = rest;
		expect(getFreePlanId()).toBeUndefined();
	});
});

describe("getShowcasePlan()", () => {
	it("prefers the seat-based plan", () => {
		catalog.plans = APP_PLANS;
		expect(getShowcasePlan()).toEqual({ id: "team", plan: APP_PLANS.team });
	});

	it("falls back to the first paid plan when none is seat-based", () => {
		const { team: _team, ...rest } = APP_PLANS;
		catalog.plans = rest;
		expect(getShowcasePlan()).toEqual({ id: "solo", plan: APP_PLANS.solo });
	});

	it("returns undefined when the catalog has no paid plan", () => {
		catalog.plans = { starter: APP_PLANS.starter, scale: APP_PLANS.scale };
		expect(getShowcasePlan()).toBeUndefined();
	});
});
