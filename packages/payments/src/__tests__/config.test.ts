import { config } from "@fuutu/config";
import { afterEach, describe, expect, it } from "vitest";

import {
	BILLING_CURRENCY,
	CREDITS,
	FEATURE_CATALOG,
	type FeatureEntry,
	getSeatUpgradeUrl,
	isPaymentsEnabled,
	LIMITS,
	PLAN_IDS,
	PLANS,
	type Plan,
	type PlanLimits,
	paymentsConfig,
	setPaymentProvider,
	TIER_ORDER,
} from "../config";
import { planIdToTier } from "../features";

const originalProvider = paymentsConfig.provider;

afterEach(() => {
	paymentsConfig.provider = originalProvider;
});

// These tests validate the app's REAL catalog (whatever PLANS holds) —
// structural invariants only, no demo-plan literals, so they stay
// meaningful when an app replaces the catalog. Plan behavior is tested on
// the fixed fixture catalog (@fuutu/test-utils) in the other suites.
const LIMIT_KEYS: (keyof PlanLimits)[] = [
	"organizations",
	"membersPerOrg",
	"apiKeys",
	"webhooks",
	"storageMb",
	"auditLogDays",
];

describe("paymentsConfig", () => {
	it("billingAttachedTo is either 'user' or 'organization'", () => {
		expect(["user", "organization"]).toContain(
			paymentsConfig.billingAttachedTo,
		);
	});

	it("billingAttachedTo is 'organization' when organizationsMode is on, 'user' when off", () => {
		const expected =
			config.features.organizationsMode !== "off" ? "organization" : "user";
		expect(paymentsConfig.billingAttachedTo).toBe(expected);
	});

	it("provider is 'noop' when features.payments is false, else 'creem'", () => {
		expect(paymentsConfig.provider).toBe(
			config.features.payments !== true ? "noop" : "creem",
		);
	});

	it("isPaymentsEnabled() reflects the configured provider", () => {
		expect(isPaymentsEnabled()).toBe(paymentsConfig.provider !== "noop");
		paymentsConfig.provider = "noop";
		expect(isPaymentsEnabled()).toBe(false);
	});

	it("setPaymentProvider mutates the provider when payments are enabled", () => {
		setPaymentProvider("stripe");
		expect(paymentsConfig.provider).toBe("stripe");
	});
});

describe("PLANS object structure", () => {
	it("has at least one plan and no duplicate plan ids", () => {
		expect(PLAN_IDS.length).toBeGreaterThan(0);
		expect(new Set(PLAN_IDS).size).toBe(PLAN_IDS.length);
	});

	it("every plan id is a key of LIMITS and CREDITS", () => {
		for (const id of PLAN_IDS) {
			expect(Object.hasOwn(LIMITS, id), `LIMITS.${id}`).toBe(true);
			expect(Object.hasOwn(CREDITS, id), `CREDITS.${id}`).toBe(true);
		}
	});

	for (const id of PLAN_IDS) {
		describe(`plan: ${id}`, () => {
			it("has an id (key in PLANS)", () => {
				expect(PLANS[id]).toBeDefined();
			});

			it("has a non-empty id", () => {
				expect(typeof id).toBe("string");
				expect(id.length).toBeGreaterThan(0);
			});

			it("has amount", () => {
				expect(typeof PLANS[id].amount).toBe("number");
			});

			it("has currency", () => {
				expect(typeof PLANS[id].currency).toBe("string");
			});

			it("has billingType", () => {
				expect(PLANS[id].billingType).toBeDefined();
			});

			it("has displayPrice", () => {
				expect(typeof PLANS[id].displayPrice).toBe("string");
			});

			it("has showInSaas flag", () => {
				expect(typeof PLANS[id].showInSaas).toBe("boolean");
			});

			it("has showInMarketing flag", () => {
				expect(typeof PLANS[id].showInMarketing).toBe("boolean");
			});
		});
	}

	it("amount matches billingType: free = 0, custom = -1, paid > 0", () => {
		for (const id of PLAN_IDS) {
			const plan: Plan = PLANS[id];
			if (plan.billingType === "free") expect(plan.amount, id).toBe(0);
			else if (plan.billingType === "custom") expect(plan.amount, id).toBe(-1);
			else expect(plan.amount, id).toBeGreaterThan(0);
		}
	});

	it("only subscription plans declare an interval", () => {
		for (const id of PLAN_IDS) {
			const plan: Plan = PLANS[id];
			if (plan.billingType === "subscription") {
				expect(["month", "year"], id).toContain(plan.interval);
			} else {
				expect(plan.interval, id).toBeUndefined();
			}
		}
	});

	it("trials are positive whole days on subscription plans only", () => {
		for (const id of PLAN_IDS) {
			const plan: Plan = PLANS[id];
			if (plan.trialDays === undefined) continue;
			expect(plan.billingType, id).toBe("subscription");
			expect(Number.isInteger(plan.trialDays) && plan.trialDays > 0, id).toBe(
				true,
			);
		}
	});

	it("a plan with a yearly price shows a yearly display price", () => {
		for (const id of PLAN_IDS) {
			const plan: Plan = PLANS[id];
			if (!plan.priceIdEnvVars?.year) continue;
			expect(typeof plan.yearlyDisplayPrice, id).toBe("string");
		}
	});

	it("checkoutable plans map a provider price env var; free and custom plans none", () => {
		for (const id of PLAN_IDS) {
			const plan: Plan = PLANS[id];
			if (plan.billingType === "free" || plan.billingType === "custom") {
				expect(plan.priceIdEnvVars, id).toBeUndefined();
			} else {
				expect(
					plan.priceIdEnvVars?.month ?? plan.priceIdEnvVars?.year,
					id,
				).toMatch(/^[A-Z][A-Z0-9_]*$/);
			}
		}
	});

	// `tier` is optional: a plan without one counts as "free" (planIdToTier;
	// pinned explicitly in tier.test.ts). Every plan is checked, none skipped.
	it("every plan resolves to a tier in TIER_ORDER (no tier → free)", () => {
		for (const id of PLAN_IDS) {
			const plan: Plan = PLANS[id];
			expect(planIdToTier(id), id).toBe(plan.tier ?? "free");
			expect(TIER_ORDER, id).toContain(planIdToTier(id));
		}
	});
});

describe("LIMITS object structure", () => {
	it("has an entry for every plan in PLANS", () => {
		for (const id of PLAN_IDS) {
			expect(LIMITS[id]).toBeDefined();
		}
	});

	for (const id of PLAN_IDS) {
		describe(`limits: ${id}`, () => {
			it("has all limit keys", () => {
				for (const key of LIMIT_KEYS) {
					expect(LIMITS[id][key]).toBeDefined();
				}
			});
		});
	}

	it("every limit is a non-negative whole number, 'unlimited' or false", () => {
		for (const id of PLAN_IDS) {
			for (const key of LIMIT_KEYS) {
				const value: unknown = LIMITS[id][key];
				const valid =
					value === "unlimited" ||
					value === false ||
					(typeof value === "number" && Number.isInteger(value) && value >= 0);
				expect(valid, `${id}.${key} = ${String(value)}`).toBe(true);
			}
		}
	});
});

describe("FEATURE_CATALOG structure", () => {
	it("is a record of categories", () => {
		expect(typeof FEATURE_CATALOG).toBe("object");
		expect(Object.keys(FEATURE_CATALOG).length).toBeGreaterThan(0);
	});

	it("each entry has a tier", () => {
		for (const entries of Object.values(FEATURE_CATALOG)) {
			for (const featureEntry of Object.values(entries) as FeatureEntry[]) {
				expect(featureEntry.tier).toBeDefined();
				expect(TIER_ORDER).toContain(featureEntry.tier);
			}
		}
	});

	it("entries with limitKey reference valid PlanLimits keys", () => {
		for (const entries of Object.values(FEATURE_CATALOG)) {
			for (const featureEntry of Object.values(entries) as FeatureEntry[]) {
				if (featureEntry.limitKey) {
					expect(LIMIT_KEYS).toContain(featureEntry.limitKey);
				}
			}
		}
	});
});

describe("catalog integrity", () => {
	it("every PLANS key has a corresponding LIMITS entry", () => {
		for (const id of PLAN_IDS) {
			expect(LIMITS[id]).toBeDefined();
		}
	});

	it("no orphaned LIMITS or CREDITS entries (every key is a plan id)", () => {
		const ids: readonly string[] = PLAN_IDS;
		for (const key of [...Object.keys(LIMITS), ...Object.keys(CREDITS)]) {
			expect(ids).toContain(key);
		}
	});

	it("every feature limitKey has a corresponding limit in every plan", () => {
		for (const entries of Object.values(FEATURE_CATALOG)) {
			for (const featureEntry of Object.values(entries) as FeatureEntry[]) {
				if (featureEntry.limitKey) {
					for (const planId of PLAN_IDS) {
						expect(LIMITS[planId][featureEntry.limitKey]).toBeDefined();
					}
				}
			}
		}
	});
});

describe("getSeatUpgradeUrl()", () => {
	afterEach(() => {
		paymentsConfig.seatUpgradeUrl = undefined;
	});

	it("defaults to the org's in-app billing page", () => {
		expect(getSeatUpgradeUrl("acme")).toBe(
			"/organizations/acme/settings/billing",
		);
	});

	it("uses paymentsConfig.seatUpgradeUrl when configured", () => {
		paymentsConfig.seatUpgradeUrl = (slug) => `https://shop.test/${slug}`;
		expect(getSeatUpgradeUrl("acme")).toBe("https://shop.test/acme");
	});
});

describe("billing currency", () => {
	it("every plan bills in BILLING_CURRENCY", () => {
		for (const id of PLAN_IDS) {
			expect(PLANS[id].currency, id).toBe(BILLING_CURRENCY);
		}
	});

	it("priced plans display their amount in BILLING_CURRENCY", () => {
		const format = (cents: number) =>
			new Intl.NumberFormat("en", {
				style: "currency",
				currency: BILLING_CURRENCY,
				minimumFractionDigits: 0,
				maximumFractionDigits: 2,
			}).format(cents / 100);
		for (const id of PLAN_IDS) {
			const plan: Plan = PLANS[id];
			if (plan.amount <= 0) continue;
			expect(plan.displayPrice, id).toBe(format(plan.amount));
		}
	});
});
