import { describe, expect, it } from "vitest";
import { LIMITS, PLANS, type PlanId } from "../config";
import {
	formatLimit,
	getFeaturesForTier,
	getLimit,
	type LimitKey,
	planIdToTier,
} from "../features";
import { buildPricingTiers, type PlanTranslations } from "../plans";

const ALL_PLAN_IDS: PlanId[] = ["free", "pro", "enterprise"];
const ALL_LIMIT_KEYS: LimitKey[] = [
	"organizations",
	"membersPerOrg",
	"apiKeys",
	"storageMb",
	"auditLogDays",
];

const mockTranslations = (id: PlanId): PlanTranslations => ({
	name: id,
	description: `${id} plan`,
	priceSuffix: "/mo",
	yearlyPriceSuffix: "/yr",
	featureLabels: {},
	ctaLabel: "Choose",
});

describe("buildPricingTiers()", () => {
	it("returns tiers for marketing audience", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
		});
		expect(tiers.length).toBe(3);
		expect(tiers.map((t) => t.id)).toEqual(["free", "pro", "enterprise"]);
	});

	it("returns tiers for saas audience", () => {
		const tiers = buildPricingTiers({
			audience: "saas",
			t: mockTranslations,
		});
		expect(tiers.length).toBe(3);
	});

	it("each tier has required fields", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
		});
		for (const tier of tiers) {
			expect(typeof tier.id).toBe("string");
			expect(typeof tier.name).toBe("string");
			expect(typeof tier.description).toBe("string");
			expect(typeof tier.price).toBe("string");
			expect(typeof tier.ctaLabel).toBe("string");
			expect(Array.isArray(tier.features)).toBe(true);
			expect(Array.isArray(tier.featureIds)).toBe(true);
		}
	});

	it("pro tier has yearly price", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
		});
		const proTier = tiers.find((t) => t.id === "pro");
		expect(proTier?.yearlyPrice).toBeDefined();
		expect(proTier?.yearlyPriceSuffix).toBeDefined();
	});

	it("free tier has no yearly price", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
		});
		const freeTier = tiers.find((t) => t.id === "free");
		expect(freeTier?.yearlyPrice).toBeUndefined();
	});

	it("pro tier is highlighted", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
		});
		const proTier = tiers.find((t) => t.id === "pro");
		expect(proTier?.highlighted).toBe(true);
	});

	it("priceSuffix is set when showPriceSuffix is true", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
		});
		const freeTier = tiers.find((t) => t.id === "free");
		expect(freeTier?.priceSuffix).toBe("/mo");
	});

	it("priceSuffix is undefined when showPriceSuffix is false", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: (id) => ({ ...mockTranslations(id), priceSuffix: undefined }),
		});
		const enterpriseTier = tiers.find((t) => t.id === "enterprise");
		expect(enterpriseTier?.priceSuffix).toBeUndefined();
	});

	it("uses displayPrice from PLANS config", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
		});
		const freeTier = tiers.find((t) => t.id === "free");
		expect(freeTier?.price).toBe(PLANS.free.displayPrice);
		const proTier = tiers.find((t) => t.id === "pro");
		expect(proTier?.price).toBe(PLANS.pro.displayPrice);
	});

	it("onCtaClick is set when handler provided and CTA not disabled", () => {
		const tiers = buildPricingTiers({
			audience: "saas",
			t: mockTranslations,
			onCtaClick: () => {},
		});
		const proTier = tiers.find((t) => t.id === "pro");
		expect(typeof proTier?.onCtaClick).toBe("function");
	});

	it("onCtaClick is undefined when CTA is disabled (free plan in saas)", () => {
		const tiers = buildPricingTiers({
			audience: "saas",
			t: mockTranslations,
			onCtaClick: () => {},
		});
		const freeTier = tiers.find((t) => t.id === "free");
		expect(freeTier?.onCtaClick).toBeUndefined();
	});

	it("ctaHref is undefined when onCtaClick is provided", () => {
		const tiers = buildPricingTiers({
			audience: "saas",
			t: mockTranslations,
			onCtaClick: () => {},
		});
		for (const tier of tiers) {
			expect(tier.ctaHref).toBeUndefined();
		}
	});

	it("enterprise tier has marketingCtaHref in marketing audience", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
		});
		const enterpriseTier = tiers.find((t) => t.id === "enterprise");
		expect(enterpriseTier?.ctaHref).toBe(PLANS.enterprise.marketingCtaHref);
	});

	it("disabled is true for free plan in saas (saasCtaDisabled)", () => {
		const tiers = buildPricingTiers({
			audience: "saas",
			t: mockTranslations,
		});
		const freeTier = tiers.find((t) => t.id === "free");
		expect(freeTier?.disabled).toBe(true);
	});

	it("disabled is true when loadingId matches plan id", () => {
		const tiers = buildPricingTiers({
			audience: "saas",
			t: mockTranslations,
			loadingId: "pro",
		});
		const proTier = tiers.find((t) => t.id === "pro");
		expect(proTier?.disabled).toBe(true);
	});

	it("disabled is true for all when allDisabled is true", () => {
		const tiers = buildPricingTiers({
			audience: "saas",
			t: mockTranslations,
			allDisabled: true,
		});
		for (const tier of tiers) {
			expect(tier.disabled).toBe(true);
		}
	});

	it("hrefFor override takes precedence over catalog href", () => {
		const tiers = buildPricingTiers({
			audience: "marketing",
			t: mockTranslations,
			hrefFor: () => "https://custom.example.com/signup",
		});
		const freeTier = tiers.find((t) => t.id === "free");
		expect(freeTier?.ctaHref).toBe("https://custom.example.com/signup");
	});
});

describe("getFeaturesForTier()", () => {
	it("returns features for free tier", () => {
		const features = getFeaturesForTier("free");
		expect(features.length).toBeGreaterThan(0);
		for (const f of features) {
			expect(f.tier).toBe("free");
		}
	});

	it("returns more features for pro than free", () => {
		const freeFeatures = getFeaturesForTier("free");
		const proFeatures = getFeaturesForTier("pro");
		expect(proFeatures.length).toBeGreaterThan(freeFeatures.length);
	});

	it("returns most features for enterprise", () => {
		const proFeatures = getFeaturesForTier("pro");
		const enterpriseFeatures = getFeaturesForTier("enterprise");
		expect(enterpriseFeatures.length).toBeGreaterThanOrEqual(
			proFeatures.length,
		);
	});

	it("free features are subset of pro features", () => {
		const freeFeatures = getFeaturesForTier("free");
		const proFeatures = getFeaturesForTier("pro");
		const proIds = new Set(proFeatures.map((f) => f.id));
		for (const f of freeFeatures) {
			expect(proIds.has(f.id)).toBe(true);
		}
	});

	it("pro features are subset of enterprise features", () => {
		const proFeatures = getFeaturesForTier("pro");
		const enterpriseFeatures = getFeaturesForTier("enterprise");
		const enterpriseIds = new Set(enterpriseFeatures.map((f) => f.id));
		for (const f of proFeatures) {
			expect(enterpriseIds.has(f.id)).toBe(true);
		}
	});
});

describe("getLimit()", () => {
	for (const planId of ALL_PLAN_IDS) {
		for (const limitKey of ALL_LIMIT_KEYS) {
			it(`returns correct value for ${planId}.${limitKey}`, () => {
				const result = getLimit(planId, limitKey);
				expect(result).toBe(LIMITS[planId][limitKey]);
			});
		}
	}

	it("returns false for free.auditLogDays (feature not available)", () => {
		expect(getLimit("free", "auditLogDays")).toBe(false);
	});

	it("returns 'unlimited' for enterprise.organizations", () => {
		expect(getLimit("enterprise", "organizations")).toBe("unlimited");
	});
});

describe("formatLimit()", () => {
	it("formats numeric value as string", () => {
		expect(formatLimit(5)).toBe("5");
		expect(formatLimit(10)).toBe("10");
		expect(formatLimit(500)).toBe("500");
	});

	it("formats 'unlimited' as infinity symbol", () => {
		expect(formatLimit("unlimited")).toBe("∞");
	});

	it("formats false as em dash", () => {
		expect(formatLimit(false)).toBe("—");
	});

	it("formats 0 as '0'", () => {
		expect(formatLimit(0)).toBe("0");
	});
});

describe("planIdToTier()", () => {
	it("maps free to free", () => {
		expect(planIdToTier("free")).toBe("free");
	});

	it("maps pro to pro", () => {
		expect(planIdToTier("pro")).toBe("pro");
	});

	it("maps enterprise to enterprise", () => {
		expect(planIdToTier("enterprise")).toBe("enterprise");
	});
});
