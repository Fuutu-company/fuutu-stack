import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `appDocs.layoutSlots` — fumadocs layout slots merged after the kit's own
 * `languageSelect` slot in the docs layout. Unset (`undefined` spread) the
 * layout gets exactly the kit slots; set, app slots win by name.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

describe("appDocs.layoutSlots", () => {
	const layout = read("apps/docs/src/app/[locale]/docs/layout.tsx");
	const slotsBlock = layout.match(/slots=\{\{([\s\S]*?)\}\}\s*>/)?.[1] ?? "";

	it("is typed as fumadocs layout slots on the contract", () => {
		const contract = read("apps/docs/src/lib/extensions.ts");
		expect(contract).toMatch(
			/import type \{ DocsSlots \} from "fumadocs-ui\/layouts\/docs"/,
		);
		expect(contract).toMatch(/layoutSlots\?: Partial<DocsSlots>;/);
	});

	it("is read from appDocs in the docs layout", () => {
		expect(layout).toMatch(/const \{[^}]*\blayoutSlots\b[^}]*\} = appDocs;/);
	});

	it("is spread after the kit languageSelect slot, so app slots win", () => {
		const kit = slotsBlock.indexOf("languageSelect:");
		const spread = slotsBlock.indexOf("...layoutSlots");
		expect(kit).toBeGreaterThanOrEqual(0);
		expect(spread).toBeGreaterThan(kit);
	});

	it("spreads nothing else into the slots (unset = kit slots only)", () => {
		expect(slotsBlock.match(/\.\.\.\w+/g)).toEqual(["...layoutSlots"]);
	});

	it("sets the kit shell slots before the spread, so app slots still win", () => {
		const spread = slotsBlock.indexOf("...layoutSlots");
		for (const slot of ["container:", "header:", "sidebar:"]) {
			const at = slotsBlock.indexOf(slot);
			expect(at, slot).toBeGreaterThanOrEqual(0);
			expect(at, slot).toBeLessThan(spread);
		}
	});
});
