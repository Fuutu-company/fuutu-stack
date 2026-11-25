import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kit-source only: the kit's own docs files wire the app-style shell and
 * the generated docs home. A buyer may rewrite these files freely.
 */

const ROOT = join(import.meta.dirname, "../../../../..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

describe("docs shell wiring (kit source)", () => {
	it("sets the kit shell slots before the appDocs.layoutSlots spread", () => {
		const layout = read("apps/docs/src/app/[locale]/docs/layout.tsx");
		const slotsBlock = layout.match(/slots=\{\{([\s\S]*?)\}\}\s*>/)?.[1] ?? "";
		const spread = slotsBlock.indexOf("...layoutSlots");
		expect(spread).toBeGreaterThanOrEqual(0);
		for (const slot of ["container:", "header:", "sidebar:"]) {
			const at = slotsBlock.indexOf(slot);
			expect(at, slot).toBeGreaterThanOrEqual(0);
			expect(at, slot).toBeLessThan(spread);
		}
	});

	it("renders the kit docs home unless the app sets appDocs.Home", () => {
		expect(read("apps/docs/src/app/[locale]/page.tsx")).toMatch(
			/appDocs\.Home \? \(\s*<appDocs\.Home locale=\{locale\} \/>\s*\) : \(\s*<DocsHome locale=\{locale\} \/>\s*\)/,
		);
	});
});
