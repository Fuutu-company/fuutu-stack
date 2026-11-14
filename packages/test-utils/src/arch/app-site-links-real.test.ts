import { describe, expect, it } from "vitest";

/**
 * The real `apps/marketing/src/app-site-links.ts` merged by the real
 * `lib/site-links.ts` — no mocks. `site-links` throws at import on an
 * unknown group, anchor or removal key; the navbar imports it, so a typo
 * in the app file crashes every marketing page. This test makes that typo
 * fail `pnpm test` instead.
 */

describe("app site links (real app file)", () => {
	it("merges the app's links into the kit navigation without throwing", async () => {
		const links = await import("../../../../apps/marketing/src/lib/site-links");
		expect(links.NAV_ORDER.length).toBeGreaterThan(0);
		const navKeys = links.NAV_ORDER.map((entry: { key: string }) => entry.key);
		expect(new Set(navKeys).size).toBe(navKeys.length);
		expect(links.FOOTER_COLUMNS.length).toBeGreaterThan(0);
	});
});
