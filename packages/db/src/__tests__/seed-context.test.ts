import { describe, expect, it } from "vitest";
import { seedsDemoPurchase } from "../../prisma/seed-context";

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
