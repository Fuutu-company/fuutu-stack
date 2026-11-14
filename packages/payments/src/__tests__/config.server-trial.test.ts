import { describe, expect, it, vi } from "vitest";
import type { PlanId } from "../config";

// Kit catalog fixture plus a trial-once plan with no-trial products.
vi.mock("../config", async (importOriginal) => {
	const actual = {
		...(await importOriginal<typeof import("../config")>()),
		...(await import("@fuutu/test-utils")).planCatalogFixture,
	};
	const PLANS = {
		...actual.PLANS,
		team: {
			amount: 900,
			currency: "usd",
			billingType: "subscription",
			interval: "month",
			trialDays: 14,
			trialOnce: true,
			displayPrice: "$9",
			showInSaas: true,
			showInMarketing: true,
			priceIdEnvVars: {
				month: "PAYMENTS_TEAM_PRICE_ID",
				year: "PAYMENTS_TEAM_YEARLY_PRICE_ID",
			},
			noTrialPriceIdEnvVars: { month: "PAYMENTS_TEAM_NOTRIAL_PRICE_ID" },
		},
	};
	return { ...actual, PLANS, PLAN_IDS: Object.keys(PLANS) };
});

vi.mock("@fuutu/env/saas", () => ({
	env: {
		PAYMENTS_PRO_PRICE_ID: "price-pro-monthly",
		PAYMENTS_TEAM_PRICE_ID: "prod-team-trial",
		PAYMENTS_TEAM_YEARLY_PRICE_ID: "prod-team-yearly",
		PAYMENTS_TEAM_NOTRIAL_PRICE_ID: "prod-team-notrial",
		NODE_ENV: "test",
	},
}));

const {
	getPlanIdForProductId,
	getPlanNoTrialPriceId,
	getPlanPriceId,
	getPlanPriceIds,
} = await import("../config.server");

const team = "team" as string as PlanId;
const pro = "pro" as string as PlanId;

describe("no-trial products (Plan.noTrialPriceIdEnvVars)", () => {
	it("no-trial product ids map back to their plan", () => {
		expect(getPlanIdForProductId("prod-team-notrial")).toBe("team");
		expect(getPlanIdForProductId("prod-team-trial")).toBe("team");
	});

	it("getPlanPriceId with trial false returns the no-trial id when one is configured", () => {
		expect(getPlanPriceId(team, "month", { trial: false })).toBe(
			"prod-team-notrial",
		);
	});

	it("falls back to the normal id without a no-trial id for the interval", () => {
		expect(getPlanPriceId(team, "year", { trial: false })).toBe(
			"prod-team-yearly",
		);
		expect(getPlanPriceId(pro, "month", { trial: false })).toBe(
			"price-pro-monthly",
		);
	});

	it("with a trial (or no option) it returns the normal id", () => {
		expect(getPlanPriceId(team, "month", { trial: true })).toBe(
			"prod-team-trial",
		);
		expect(getPlanPriceId(team, "month")).toBe("prod-team-trial");
	});

	it("getPlanNoTrialPriceId reports only a configured no-trial id", () => {
		expect(getPlanNoTrialPriceId(team, "month")).toBe("prod-team-notrial");
		expect(getPlanNoTrialPriceId(team, "year")).toBeUndefined();
		expect(getPlanNoTrialPriceId(pro, "month")).toBeUndefined();
	});

	it("getPlanPriceIds never lists no-trial ids", () => {
		expect(getPlanPriceIds()).toEqual({
			pro: { monthly: "price-pro-monthly", yearly: undefined },
			team: { monthly: "prod-team-trial", yearly: "prod-team-yearly" },
		});
	});
});
