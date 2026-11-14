import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: the kit's pricing / billing components derive plan roles
 * from the catalog (`seatBased`, `billingType`, `marketingCtaHref`, tier
 * order) instead of naming the kit demo plans. An app that replaces
 * `PLANS` with its own ids must type-check and render them unforked.
 * `pricing.enterprise.*` stays allowed: it is a marketing copy namespace,
 * not a plan id.
 */

const ROOT = join(import.meta.dirname, "../../../..");

const FILES = [
	"apps/saas/src/modules/app/payments/choose-plan.tsx",
	"apps/saas/src/modules/app/organizations/org-settings-billing.tsx",
	"apps/marketing/src/modules/marketing/pricing/components/pricing-cards.tsx",
	"apps/marketing/src/modules/marketing/home/components/hero.tsx",
	"apps/marketing/src/modules/marketing/home/components/feature-bento.tsx",
	"apps/marketing/src/modules/marketing/home/components/cta.tsx",
	"apps/saas/src/modules/app/design-system/components/pricing-parts.tsx",
];

/** `"free"` there is a tier name (`TIER_ORDER`), so only `LIMITS.<id>` is checked. */
const LIMITS_ONLY_FILES = ["packages/payments/src/features.ts"];

const KIT_IDS = "free|pro|enterprise";
const FORBIDDEN: [string, RegExp][] = [
	["PLANS.<kit id>", new RegExp(`\\bPLANS\\.(${KIT_IDS})\\b`)],
	// `billingType === "free"` is a billing type, not a plan id.
	[
		"a kit plan id string",
		new RegExp(`(?<!billingType === )["'\`](${KIT_IDS})["'\`]`),
	],
	[
		"an object keyed by a kit plan id",
		new RegExp(`^\\s*(${KIT_IDS}):\\s`, "m"),
	],
	["a plan translation by kit id", new RegExp(`\\bplans\\.(${KIT_IDS})\\.`)],
	["LIMITS.<kit id>", new RegExp(`\\bLIMITS\\.(${KIT_IDS})\\b`)],
	["a plan-id keyed icon map", /\bPLAN_ICONS\b/],
];

describe("no kit plan-id literals in pricing components", () => {
	for (const file of FILES) {
		it(file, () => {
			const source = readFileSync(join(ROOT, file), "utf8");
			for (const [label, pattern] of FORBIDDEN) {
				expect(source, `${file}: ${label}`).not.toMatch(pattern);
			}
		});
	}
});

describe("no kit plan ids as LIMITS keys in payments helpers", () => {
	for (const file of LIMITS_ONLY_FILES) {
		it(file, () => {
			const source = readFileSync(join(ROOT, file), "utf8");
			expect(source, `${file}: LIMITS.<kit id>`).not.toMatch(
				new RegExp(`\\bLIMITS\\.(${KIT_IDS})\\b`),
			);
		});
	}
});
