import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Switchable kit pages (`appKitRoutes`): every route folder must carry a
 * `layout.tsx` that calls `notFound()` when `isKitRouteEnabled(<route>)`
 * is false. `notFound()` inside `generateMetadata` alone would answer
 * 200 (metadata streams after the status line); a layout answers a real
 * 404, with the page, its `loading.tsx` and sub-routes behind it.
 */

const ROOT = join(import.meta.dirname, "../../../../..");
const LOCALE_DIR = join(ROOT, "apps/marketing/src/app/(marketing)/[locale]");
const ROUTES = ["pricing", "blog", "changelog", "contact"];

describe("switchable kit routes", () => {
	it("names every route folder the resolver knows", () => {
		const source = readFileSync(
			join(ROOT, "apps/marketing/src/lib/kit-routes.ts"),
			"utf8",
		);
		expect(source).toMatch(
			/KIT_ROUTES = \["pricing", "blog", "changelog", "contact"\] as const/,
		);
	});

	for (const route of ROUTES) {
		it(`/${route} has a layout that 404s while the route is switched off`, () => {
			const file = join(LOCALE_DIR, route, "layout.tsx");
			expect(existsSync(file), `${route}/layout.tsx`).toBe(true);
			const layout = readFileSync(file, "utf8");
			expect(layout).toMatch(
				new RegExp(
					`if \\(!isKitRouteEnabled\\("${route}"\\)\\) notFound\\(\\);`,
				),
			);
			expect(layout).toMatch(/return children;/);
		});
	}

	it("the blog OG image route 404s while the blog is switched off", () => {
		const og = readFileSync(
			join(LOCALE_DIR, "blog/[slug]/opengraph-image.tsx"),
			"utf8",
		);
		expect(og).toMatch(
			/if \(!isKitRouteEnabled\("blog"\)\) return new Response\(null, \{ status: 404 \}\);/,
		);
		expect(og).toMatch(/!slug \|\| !isKitRouteEnabled\("blog"\)/);
	});

	it("no loading.tsx or Suspense boundary sits above the gating layouts", () => {
		expect(existsSync(join(LOCALE_DIR, "loading.tsx"))).toBe(false);
		expect(existsSync(join(ROOT, "apps/marketing/src/app/loading.tsx"))).toBe(
			false,
		);
	});
});
