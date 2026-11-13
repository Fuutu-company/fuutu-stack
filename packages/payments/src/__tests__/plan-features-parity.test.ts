import { describe, expect, it } from "vitest";
import type { PlanId } from "../config";
import { buildPricingTiers, type PlanTranslations } from "../plans";

// Runs on the REAL catalog (no plan fixture): the check-translations
// script parses this app's config.ts, so both sides must see the same
// PLANS / FEATURE_CATALOG.
const mockTranslations = (id: PlanId): PlanTranslations => ({
	name: id,
	description: `${id} plan`,
	priceSuffix: "/mo",
	yearlyPriceSuffix: "/yr",
	featureLabels: {},
	ctaLabel: "Choose",
});

describe("check-translations plan feature parity", () => {
	it("the script lists exactly the features buildPricingTiers renders", async () => {
		const { readFileSync } = await import("node:fs");
		const { extractVisiblePlanFeatures } = await import(
			"../../../i18n/scripts/plan-features.mjs"
		);
		const source = readFileSync(new URL("../config.ts", import.meta.url), {
			encoding: "utf-8",
		});

		const rendered: Record<string, string[]> = {};
		for (const audience of ["saas", "marketing"] as const) {
			for (const tier of buildPricingTiers({ audience, t: mockTranslations })) {
				rendered[tier.id] = tier.featureIds;
			}
		}

		expect(extractVisiblePlanFeatures(source)).toEqual(rendered);
	});
});
