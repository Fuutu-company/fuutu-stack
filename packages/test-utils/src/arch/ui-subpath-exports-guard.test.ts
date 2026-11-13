import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guard: the `@fuutu/ui` root barrel ships components, hooks and `cn` only.
 * Non-component tooling (color math, contrast pairs, chart geometry) lives
 * behind subpath exports, which must resolve for the apps at runtime and
 * point at a TypeScript source (types and runtime share the file).
 */
const REPO_ROOT = join(import.meta.dirname, "../../../../");
const UI_DIR = join(REPO_ROOT, "packages/ui");
const fromSaas = createRequire(join(REPO_ROOT, "apps/saas/package.json"));

const SUBPATHS: Record<string, string[]> = {
	"@fuutu/ui/color": [
		"parseColor",
		"compositeOver",
		"relativeLuminance",
		"contrastRatio",
		"isInSrgbGamut",
		"WCAG_AA",
		"CONTRAST_PAIRS",
	],
	"@fuutu/ui/stacked-bars": ["buildStackedBars"],
};

describe("@fuutu/ui subpath exports", () => {
	it("the root barrel re-exports nothing from lib/ but cn", () => {
		const barrel = readFileSync(join(UI_DIR, "src/index.ts"), "utf8");
		const libSources = [
			...barrel.matchAll(/from\s*["'](\.\/lib\/[^"']+)["']/g),
		].map((m) => m[1]);
		expect(libSources).toEqual(["./lib/utils"]);
	});

	for (const [specifier, names] of Object.entries(SUBPATHS)) {
		it(`${specifier} resolves from an app to a TypeScript source`, () => {
			expect(fromSaas.resolve(specifier)).toMatch(/packages\/ui\/src\/.+\.ts$/);
		});

		it(`${specifier} exports its helpers at runtime`, async () => {
			const mod: Record<string, unknown> = await import(
				pathToFileURL(fromSaas.resolve(specifier)).href
			);
			for (const name of names) {
				expect(mod[name], `${specifier} → ${name}`).toBeDefined();
			}
		});
	}
});
