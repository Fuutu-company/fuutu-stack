import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../../../..");

/**
 * The real `apps/marketing/src/app-site-links.ts` merged by the real
 * `lib/site-links.ts` — no mocks. `site-links` throws at import on an
 * unknown group, anchor or removal key; the navbar imports it, so a typo
 * in the app file crashes every marketing page. This test makes that typo
 * fail `pnpm test` instead.
 */

describe("app site links (real app file)", () => {
	it("merges the app's links into the kit navigation without throwing", async () => {
		// Non-literal path: app-site-links may import `.tsx` (footer actions),
		// which this package's tsc must not follow.
		const links = (await import(
			/* @vite-ignore */ join(ROOT, "apps/marketing/src/lib/site-links.ts")
		)) as {
			NAV_ORDER: { key: string }[];
			FOOTER_COLUMNS: unknown[];
		};
		expect(links.NAV_ORDER.length).toBeGreaterThan(0);
		const navKeys = links.NAV_ORDER.map((entry: { key: string }) => entry.key);
		expect(new Set(navKeys).size).toBe(navKeys.length);
		expect(links.FOOTER_COLUMNS.length).toBeGreaterThan(0);
	});
});
