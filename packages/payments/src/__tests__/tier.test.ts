import { fixturePlanId, fixtureTier } from "@fuutu/test-utils";
import { describe, expect, it, vi } from "vitest";

// The tier is declared on the plan and the order is one exported
// TIER_ORDER — swap both in the config and every helper must follow.
// "pro" is re-declared as the top tier and "enterprise" demoted below it.
vi.mock("../config", async (importOriginal) => {
	// Fixed kit plan catalog (@fuutu/test-utils), not the app's PLANS.
	const actual = {
		...(await importOriginal<typeof import("../config")>()),
		...(await import("@fuutu/test-utils")).planCatalogFixture,
	};
	return {
		...actual,
		TIER_ORDER: ["free", "enterprise", "pro"],
		PLANS: {
			...actual.PLANS,
			pro: { ...actual.PLANS.pro, tier: "enterprise" },
			enterprise: { ...actual.PLANS.enterprise, tier: "pro" },
		},
	};
});

// plan-resolver pulls config.server (env) and sync (db) — stub both.
vi.mock("../config.server", () => ({ getPlanIdForProductId: vi.fn() }));
vi.mock("../sync", () => ({ getActivePlanId: vi.fn() }));

const { planIdToTier, getFeaturesForTier } = await import("../features");
const { PLANS } = await import("../config");
const { meetsTier } = await import("../plan-resolver");

describe("tier on the plan", () => {
	it("planIdToTier reads the tier the plan declares", () => {
		expect(planIdToTier(fixturePlanId("pro"))).toBe("enterprise");
		expect(planIdToTier(fixturePlanId("enterprise"))).toBe("pro");
	});

	it("a plan without a declared tier counts as free (custom plans keep working)", () => {
		const plans = PLANS as Record<string, { tier?: string }>;
		const saved = plans.pro?.tier;
		delete (plans.pro as { tier?: string }).tier;
		try {
			expect(planIdToTier(fixturePlanId("pro"))).toBe("free");
		} finally {
			(plans.pro as { tier?: string }).tier = saved;
		}
	});

	it("meetsTier follows the exported TIER_ORDER", () => {
		expect(meetsTier(fixtureTier("pro"), fixtureTier("enterprise"))).toBe(true);
		expect(meetsTier(fixtureTier("enterprise"), fixtureTier("pro"))).toBe(
			false,
		);
	});

	it("getFeaturesForTier follows the exported TIER_ORDER", () => {
		const enterpriseIds = getFeaturesForTier(fixtureTier("enterprise")).map(
			(f) => f.id,
		);
		// "auth_passkeys" is a pro-tier feature — pro now ranks above enterprise.
		expect(enterpriseIds).toContain("auth_sso");
		expect(enterpriseIds).not.toContain("auth_passkeys");
	});
});
