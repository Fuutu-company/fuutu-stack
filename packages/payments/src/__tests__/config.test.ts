import { config } from "@fuutu/config";
import { describe, expect, it } from "vitest";

import {
	FEATURE_CATALOG,
	type FeatureEntry,
	LIMITS,
	PLAN_IDS,
	PLANS,
	type PlanId,
	type PlanLimits,
	paymentsConfig,
} from "../config";

const PLAN_IDS_EXPECTED: PlanId[] = ["free", "pro", "enterprise"];
const LIMIT_KEYS: (keyof PlanLimits)[] = [
	"organizations",
	"membersPerOrg",
	"apiKeys",
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
});

describe("PLANS object structure", () => {
	it("has exactly three plans: free, pro, enterprise", () => {
		expect(PLAN_IDS).toEqual(PLAN_IDS_EXPECTED);
	});

	for (const id of PLAN_IDS_EXPECTED) {
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

	it("free plan has amount 0 and billingType free", () => {
		expect(PLANS.free.amount).toBe(0);
		expect(PLANS.free.billingType).toBe("free");
	});

	it("pro plan has monthly pricing (amount + interval)", () => {
		expect(PLANS.pro.amount).toBe(1900);
		expect(PLANS.pro.interval).toBe("month");
	});

	it("pro plan has yearly display price", () => {
		expect(PLANS.pro.yearlyDisplayPrice).toBeDefined();
		expect(typeof PLANS.pro.yearlyDisplayPrice).toBe("string");
	});

	it("enterprise plan has custom billing", () => {
		expect(PLANS.enterprise.billingType).toBe("custom");
		expect(PLANS.enterprise.amount).toBe(-1);
	});
});

describe("LIMITS object structure", () => {
	it("has an entry for every plan in PLANS", () => {
		for (const id of PLAN_IDS_EXPECTED) {
			expect(LIMITS[id]).toBeDefined();
		}
	});

	for (const id of PLAN_IDS_EXPECTED) {
		describe(`limits: ${id}`, () => {
			it("has all limit keys", () => {
				for (const key of LIMIT_KEYS) {
					expect(LIMITS[id][key]).toBeDefined();
				}
			});
		});
	}

	it("free plan has numeric limits", () => {
		expect(LIMITS.free.organizations).toBe(1);
		expect(LIMITS.free.membersPerOrg).toBe(5);
		expect(LIMITS.free.apiKeys).toBe(2);
		expect(LIMITS.free.storageMb).toBe(500);
		expect(LIMITS.free.auditLogDays).toBe(false);
	});

	it("pro plan has mixed numeric and unlimited limits", () => {
		expect(LIMITS.pro.organizations).toBe(10);
		expect(LIMITS.pro.membersPerOrg).toBe(50);
		expect(LIMITS.pro.apiKeys).toBe("unlimited");
		expect(LIMITS.pro.storageMb).toBe(50_000);
		expect(LIMITS.pro.auditLogDays).toBe(30);
	});

	it("enterprise plan has all unlimited limits", () => {
		expect(LIMITS.enterprise.organizations).toBe("unlimited");
		expect(LIMITS.enterprise.membersPerOrg).toBe("unlimited");
		expect(LIMITS.enterprise.apiKeys).toBe("unlimited");
		expect(LIMITS.enterprise.storageMb).toBe("unlimited");
		expect(LIMITS.enterprise.auditLogDays).toBe("unlimited");
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
				expect(["free", "pro", "enterprise"]).toContain(featureEntry.tier);
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
		for (const id of PLAN_IDS_EXPECTED) {
			expect(LIMITS[id]).toBeDefined();
		}
	});

	it("no orphaned LIMITS entries (every LIMITS key is in PLANS)", () => {
		for (const limitKey of Object.keys(LIMITS)) {
			expect(PLAN_IDS_EXPECTED).toContain(limitKey);
		}
	});

	it("every feature limitKey has a corresponding limit in every plan", () => {
		for (const entries of Object.values(FEATURE_CATALOG)) {
			for (const featureEntry of Object.values(entries) as FeatureEntry[]) {
				if (featureEntry.limitKey) {
					for (const planId of PLAN_IDS_EXPECTED) {
						expect(LIMITS[planId][featureEntry.limitKey]).toBeDefined();
					}
				}
			}
		}
	});
});
