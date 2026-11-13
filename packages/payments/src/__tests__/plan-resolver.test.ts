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

// Catalog-agnostic: every price/product env var a plan declares resolves to
// `id_<VAR>`, so the test works with any PLANS catalog (kit or your own).
vi.mock("@fuutu/env/saas", () => {
	const base: Record<string, string> = { NODE_ENV: "test" };
	const isPriceVar = (key: PropertyKey) =>
		typeof key === "string" && /^[A-Z][A-Z0-9_]*$/.test(key);
	return {
		env: new Proxy(base, {
			get: (target, key) =>
				key in target
					? target[key as string]
					: isPriceVar(key)
						? `id_${String(key)}`
						: undefined,
			has: (target, key) => key in target || isPriceVar(key),
		}),
	};
});

// The first paid plan of the catalog, flipped to one-time per test to model
// a lifetime plan.
const billingType = vi.hoisted(() => ({ current: "subscription" }));
const paid = vi.hoisted(() => ({ id: "" }));

vi.mock("../config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../config")>();
	const entry = Object.entries(actual.PLANS).find(
		([, plan]) =>
			plan.billingType === "subscription" &&
			Object.keys(plan.priceIdEnvVars ?? {}).length > 0,
	);
	if (!entry) throw new Error("catalog has no paid plan with price IDs");
	paid.id = entry[0];
	return {
		...actual,
		PLANS: {
			...actual.PLANS,
			[entry[0]]: new Proxy(entry[1], {
				get(target, prop, receiver) {
					if (prop === "billingType") return billingType.current;
					return Reflect.get(target, prop, receiver);
				},
			}),
		},
	};
});

const { PLANS } = await import("../config");
const { planIdToTier } = await import("../features");
const { resolveActivePlan } = await import("../plan-resolver");

const planId = paid.id as keyof typeof PLANS;
const priceIds = Object.values(
	(PLANS[planId] as { priceIdEnvVars?: Record<string, string> })
		.priceIdEnvVars ?? {},
).map((key) => `id_${key}`);
const priceId = priceIds[0] as string;
const expected = { planId, tier: planIdToTier(planId) };

describe("resolveActivePlan — one-time (lifetime) plans", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		billingType.current = "one_time";
		mockGetActiveSubscriptionForUser.mockResolvedValue(null);
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(null);
		mockGetActiveOneTimePlanPurchase.mockResolvedValue(null);
	});

	it("grants the plan of an active one-time purchase to a user", async () => {
		mockGetActiveOneTimePlanPurchase.mockResolvedValue({
			id: "p1",
			type: "ONE_TIME",
			status: "ACTIVE",
			productId: priceId,
			priceId,
		});

		expect(await resolveActivePlan("user_1", null)).toEqual(expected);
		expect(mockGetActiveOneTimePlanPurchase).toHaveBeenCalledWith(
			{ userId: "user_1" },
			priceIds,
		);
	});

	it("grants the plan of an active one-time purchase to an organization", async () => {
		mockGetActiveOneTimePlanPurchase.mockResolvedValue({
			id: "p1",
			productId: priceId,
			priceId,
		});

		expect(await resolveActivePlan(null, "org_1")).toEqual(expected);
		expect(mockGetActiveOneTimePlanPurchase).toHaveBeenCalledWith(
			{ organizationId: "org_1" },
			priceIds,
		);
	});

	it("falls back to free without an active one-time purchase", async () => {
		expect(await resolveActivePlan("user_1", null)).toEqual({
			planId: "free",
			tier: "free",
		});
	});

	it("does not look up one-time purchases when no plan is one-time", async () => {
		billingType.current = "subscription";

		expect(await resolveActivePlan("user_1", null)).toEqual({
			planId: "free",
			tier: "free",
		});
		expect(mockGetActiveOneTimePlanPurchase).not.toHaveBeenCalled();
	});

	it("prefers an active subscription over a one-time purchase", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue({
			id: "s1",
			productId: priceId,
			priceId,
		});

		expect(await resolveActivePlan("user_1", null)).toEqual(expected);
		expect(mockGetActiveOneTimePlanPurchase).not.toHaveBeenCalled();
	});
});
