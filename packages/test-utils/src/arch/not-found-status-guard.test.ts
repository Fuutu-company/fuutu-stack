import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: a public page that calls `notFound()` must answer HTTP 404.
 *
 * Marketing renders dynamically (the root layout reads the locale from the
 * request). A `loading.tsx` in the page's folder or any folder above it is
 * a Suspense boundary: its fallback starts the stream with status 200
 * before the page runs, so `notFound()` can only inject `noindex` — unknown
 * slugs answer 200 ("soft 404"). Next 16: run the check before any
 * Suspense boundary (`node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/loading.md` → Status codes).
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const APP_DIRS = ["apps/marketing/src/app", "apps/docs/src/app"];

function pages(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) pages(full, out);
		else if (/^page\.tsx?$/.test(name)) out.push(full);
	}
	return out;
}

/** `loading.tsx` files that wrap the page: its folder up to the app root. */
function loadingAbove(page: string, appRoot: string): string[] {
	const found: string[] = [];
	let dir = dirname(page);
	while (dir.startsWith(appRoot)) {
		for (const ext of ["tsx", "ts", "jsx", "js"]) {
			const file = join(dir, `loading.${ext}`);
			if (existsSync(file)) found.push(relative(REPO_ROOT, file));
		}
		if (dir === appRoot) break;
		dir = dirname(dir);
	}
	return found;
}

describe("notFound() pages answer 404 (no loading.tsx above them)", () => {
	for (const appDir of APP_DIRS) {
		const appRoot = join(REPO_ROOT, appDir);
		const notFoundPages = pages(appRoot).filter((page) =>
			/\bnotFound\(\)/.test(readFileSync(page, "utf8")),
		);

		it(`${appDir} has pages to check`, () => {
			expect(notFoundPages.length).toBeGreaterThan(0);
		});

		for (const page of notFoundPages) {
			it(relative(REPO_ROOT, page), () => {
				expect(
					loadingAbove(page, appRoot),
					"Remove these loading.tsx files (or move the check into a layout above them): their Suspense fallback sends status 200 before notFound() runs.",
				).toEqual([]);
			});
		}
	}
});
