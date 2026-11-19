import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: every locale folder carries the app-owned translation overlay
 * (`translations/<locale>/app/index.ts`) and the message loader merges it.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const TRANSLATIONS = join(ROOT, "packages/i18n/translations");

const HEADER =
	"App-owned — the kit never changes this file's content after release; fill it for your app.";

const commentText = (source: string) =>
	source
		.replace(/^\s*\*\s?/gm, "")
		.replace(/\s+/g, " ")
		.trim();

const locales = readdirSync(TRANSLATIONS).filter((entry) =>
	statSync(join(TRANSLATIONS, entry)).isDirectory(),
);

describe("app translation overlay", () => {
	it("finds locale folders", () => {
		expect(locales.length).toBeGreaterThan(0);
	});

	for (const locale of locales) {
		describe(locale, () => {
			const file = join(TRANSLATIONS, locale, "app/index.ts");

			it("has an app-owned overlay file exporting appTranslations", () => {
				const source = readFileSync(file, "utf8");
				expect(commentText(source)).toContain(HEADER);
				expect(source).toMatch(/^export const appTranslations\b/m);
			});

			it("is loaded by the message loader", () => {
				const loader = readFileSync(
					join(ROOT, "packages/i18n/lib/messages.ts"),
					"utf8",
				);
				expect(loader).toContain(`../translations/${locale}/app/index`);
			});
		});
	}
});
