import { describe, expect, it } from "vitest";
import {
	DEMO_API_KEY_NAMES,
	seedDemoApiKeys,
	seedsDemoPurchase,
} from "../../prisma/seed-context";

// The kit seed's demo purchase (Acme's Pro subscription, the admin's with
// organizations off) names the kit's "pro" price. An app whose PLANS have
// no such plan turns it off in `appSeedConfig` (app-owned `app-seed.ts`).
describe("seedsDemoPurchase", () => {
	it("seeds the demo purchase by default", () => {
		expect(seedsDemoPurchase({})).toBe(true);
	});

	it("an app opts out with demoPurchase: false", () => {
		expect(seedsDemoPurchase({ demoPurchase: false })).toBe(false);
		expect(seedsDemoPurchase({ demoPurchase: true })).toBe(true);
	});
});

// The demo API keys count against the plan cap of whoever holds them
// (`LIMITS.<plan>.apiKeys`; a user's personal count includes the org keys
// they created). Only the demo Pro plan (unlimited) is known to leave room,
// so keys go only where it lies; elsewhere the seed cannot tell the plan
// and seeds none (an app's own limits, e.g. 2 keys, stay creatable).
describe("seedDemoApiKeys", () => {
	const names = (keys: { name: string }[]) => keys.map((k) => k.name);

	it("seeds all three demo keys while the admin holds the priced demo plan", () => {
		expect(
			names(
				seedDemoApiKeys({}, { demoPlanPriced: true, demoPlanOwner: "admin" }),
			),
		).toEqual(DEMO_API_KEY_NAMES);
		expect(DEMO_API_KEY_NAMES).toHaveLength(3);
	});

	it("seeds only Acme's key while Acme holds it (the admin's own plan is unknown)", () => {
		const keys = seedDemoApiKeys(
			{},
			{ demoPlanPriced: true, demoPlanOwner: "acme" },
		);
		expect(keys).toEqual([{ name: "Acme CI/CD", org: true, expired: false }]);
	});

	it("seeds none without the demo purchase or its price", () => {
		for (const demoPlanOwner of ["admin", "acme"] as const) {
			expect(
				seedDemoApiKeys(
					{ demoPurchase: false },
					{ demoPlanPriced: true, demoPlanOwner },
				),
			).toEqual([]);
			expect(
				seedDemoApiKeys({}, { demoPlanPriced: false, demoPlanOwner }),
			).toEqual([]);
		}
	});
});
