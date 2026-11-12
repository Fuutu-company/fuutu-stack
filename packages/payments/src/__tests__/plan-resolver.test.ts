import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetActiveSubscriptionForUser = vi.fn();
const mockGetActiveSubscriptionForOrganization = vi.fn();
const mockGetActiveOneTimePlanPurchase = vi.fn();

vi.mock("@fuutu/db", () => ({
	getActiveSubscriptionForUser: mockGetActiveSubscriptionForUser,
	getActiveSubscriptionForOrganization:
		mockGetActiveSubscriptionForOrganization,
	getActiveOneTimePlanPurchase: mockGetActiveOneTimePlanPurchase,
}));

vi.mock("@fuutu/credits", () => ({
	grantRecurringCredits: vi.fn(),
	grantTopUpCredits: vi.fn(),
	resetRecurringCredits: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/webhooks", () => ({ dispatchEvent: vi.fn() }));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		PAYMENTS_PRO_PRICE_ID: "price_pro_month",
		PAYMENTS_PRO_YEARLY_PRICE_ID: "price_pro_year",
		NODE_ENV: "test",
	},
}));

// The kit catalog ships no one-time plan — flip PLANS.pro's billingType
// per test to model a lifetime plan.
const proBillingType = vi.hoisted(() => ({ current: "subscription" }));

vi.mock("../config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config")>();
	return {
		...actual,
		PLANS: {
			...actual.PLANS,
			pro: new Proxy(actual.PLANS.pro, {
				get(target, prop, receiver) {
					if (prop === "billingType") return proBillingType.current;
					return Reflect.get(target, prop, receiver);
				},
			}),
		},
	};
});

const { resolveActivePlan } = await import("../plan-resolver");

describe("resolveActivePlan — one-time (lifetime) plans", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		proBillingType.current = "one_time";
		mockGetActiveSubscriptionForUser.mockResolvedValue(null);
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(null);
		mockGetActiveOneTimePlanPurchase.mockResolvedValue(null);
	});

	it("grants the plan of an active one-time purchase to a user", async () => {
		mockGetActiveOneTimePlanPurchase.mockResolvedValue({
			id: "p1",
			type: "ONE_TIME",
			status: "ACTIVE",
			productId: "price_pro_month",
			priceId: "price_pro_month",
		});

		expect(await resolveActivePlan("user_1", null)).toEqual({
			planId: "pro",
			tier: "pro",
		});
		expect(mockGetActiveOneTimePlanPurchase).toHaveBeenCalledWith(
			{ userId: "user_1" },
			["price_pro_month", "price_pro_year"],
		);
	});

	it("grants the plan of an active one-time purchase to an organization", async () => {
		mockGetActiveOneTimePlanPurchase.mockResolvedValue({
			id: "p1",
			productId: "price_pro_month",
			priceId: "price_pro_month",
		});

		expect(await resolveActivePlan(null, "org_1")).toEqual({
			planId: "pro",
			tier: "pro",
		});
		expect(mockGetActiveOneTimePlanPurchase).toHaveBeenCalledWith(
			{ organizationId: "org_1" },
			["price_pro_month", "price_pro_year"],
		);
	});

	it("falls back to free without an active one-time purchase", async () => {
		expect(await resolveActivePlan("user_1", null)).toEqual({
			planId: "free",
			tier: "free",
		});
	});

	it("does not look up one-time purchases when no plan is one-time", async () => {
		proBillingType.current = "subscription";

		expect(await resolveActivePlan("user_1", null)).toEqual({
			planId: "free",
			tier: "free",
		});
		expect(mockGetActiveOneTimePlanPurchase).not.toHaveBeenCalled();
	});

	it("prefers an active subscription over a one-time purchase", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue({
			id: "s1",
			productId: "price_pro_year",
			priceId: "price_pro_year",
		});

		expect(await resolveActivePlan("user_1", null)).toEqual({
			planId: "pro",
			tier: "pro",
		});
		expect(mockGetActiveOneTimePlanPurchase).not.toHaveBeenCalled();
	});
});
