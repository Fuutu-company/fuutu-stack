import { describe, expect, it } from "vitest";
import {
	extractVisiblePlanFeatures,
	findMissingPlanFeatureLabels,
} from "../../scripts/plan-features.mjs";

const configSource = `
export const PLANS = {
	// legacy: { tier: "enterprise", showInSaas: true },
	free: {
		tier: "free",
		displayPrice: "$0",
		showInSaas: true,
		showInMarketing: true,
	},
	pro: {
		tier: "pro",
		displayPrice: "$19", // "}" in a comment
		showInSaas: false,
		showInMarketing: true,
		priceIdEnvVars: { month: "PRO_PRICE" },
	},
	internal: {
		tier: "enterprise",
		showInSaas: false,
		showInMarketing: false,
	},
	starter: {
		showInSaas: true,
		showInMarketing: false,
	},
} as const satisfies Record<PlanId, Plan>;

export const TIER_ORDER = ["free", "pro", "enterprise"] as const;

export const FEATURE_CATALOG = {
	orgs: {
		members: { tier: "free", limitKey: "membersPerOrg" },
		audit: { tier: "pro" },
	},
	support: {
		email: { tier: "pro" },
		beta: { tier: "free", hidden: true },
		sla: { tier: "enterprise" },
	},
} as const satisfies Record<string, Record<string, FeatureEntry>>;
`;

describe("extractVisiblePlanFeatures()", () => {
	it("lists the features each rendered plan shows, up to its tier", () => {
		expect(extractVisiblePlanFeatures(configSource)).toEqual({
			free: ["orgs_members"],
			pro: ["orgs_members", "orgs_audit", "support_email"],
			starter: ["orgs_members"],
		});
	});

	it("returns null when the catalog cannot be read", () => {
		expect(extractVisiblePlanFeatures("export const X = 1;")).toBeNull();
	});
});

describe("findMissingPlanFeatureLabels()", () => {
	const planFeatures = {
		free: ["orgs_members"],
		pro: ["orgs_members", "orgs_audit"],
	};

	it("reports every rendered feature without a label", () => {
		const plans = {
			free: { featureLabels: { orgs_members: "Members" } },
			pro: { featureLabels: { orgs_members: "Members", orgs_audit: "" } },
		};
		expect(findMissingPlanFeatureLabels(planFeatures, plans, "de")).toEqual([
			"[de] Missing plan feature label: payments.plans.pro.featureLabels.orgs_audit",
		]);
	});

	it("reports all features of a plan that has no featureLabels", () => {
		expect(
			findMissingPlanFeatureLabels(
				planFeatures,
				{ free: { featureLabels: { orgs_members: "Members" } } },
				"en",
			),
		).toEqual([
			"[en] Missing plan feature label: payments.plans.pro.featureLabels.orgs_members",
			"[en] Missing plan feature label: payments.plans.pro.featureLabels.orgs_audit",
		]);
	});

	it("passes when every rendered feature has a label", () => {
		const plans = {
			free: { featureLabels: { orgs_members: "Members" } },
			pro: { featureLabels: { orgs_members: "Members", orgs_audit: "Audit" } },
		};
		expect(findMissingPlanFeatureLabels(planFeatures, plans, "en")).toEqual([]);
	});
});
