import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: a marketing `[param]` page that lists its params with
 * `generateStaticParams` must export `dynamicParams = false`.
 *
 * Without it an unlisted slug renders on demand. When the list is empty
 * (e.g. every blog post drafted or deleted) Next treats the route as
 * static, the on-demand not-found render reads the locale cookie
 * (`i18n/request.ts`), and production answers 500 ("Page changed from
 * static to dynamic at runtime") instead of 404. With `dynamicParams =
 * false` an unlisted slug is a plain 404 — listed or not, empty or not.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const APP_ROOT = join(REPO_ROOT, "apps/marketing/src/app");

function pages(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) pages(full, out);
		else if (/^page\.tsx?$/.test(name)) out.push(full);
	}
	return out;
}

/**
 * `[slug]`-style content segment — not `[...catchAll]` / `[[...optional]]`,
 * and not `[locale]` (unknown locales are resolved by the i18n proxy).
 */
const isSingleParam = (segment: string) =>
	/^\[[^.[\]]+\]$/.test(segment) && segment !== "[locale]";

const STATIC_PARAM_PAGES = pages(APP_ROOT).filter((page) => {
	const source = readFileSync(page, "utf8");
	return (
		isSingleParam(basename(dirname(page))) &&
		/export (async )?function generateStaticParams\b/.test(source)
	);
});

describe("[param] pages with generateStaticParams export dynamicParams = false", () => {
	it("covers the blog and legal routes", () => {
		const found = STATIC_PARAM_PAGES.map((p) => relative(APP_ROOT, p));
		expect(found).toEqual(
			expect.arrayContaining([
				"(marketing)/[locale]/blog/[slug]/page.tsx",
				"(marketing)/[locale]/legal/[slug]/page.tsx",
			]),
		);
	});

	for (const page of STATIC_PARAM_PAGES) {
		it(relative(REPO_ROOT, page), () => {
			expect(readFileSync(page, "utf8")).toMatch(
				/^export const dynamicParams = false;$/m,
			);
		});
	}
});
