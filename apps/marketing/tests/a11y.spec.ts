import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, scrollThroughPage, test } from "./fixtures";
import { DEFAULT_LOCALE } from "./locales";

/**
 * Accessibility: every marketing page type is scanned for WCAG 2.0 A/AA
 * violations with axe-core, in light and in dark mode. The theme is forced
 * through next-themes' storage key before the first paint.
 */

/** First legal document shipped in `@fuutu/content` (`<slug>.<locale>.tsx`). */
const LEGAL_SLUG =
	readdirSync(resolve(__dirname, "../../../packages/content/src/legal"))
		.sort()[0]
		?.split(".")[0] ?? "privacy";

const ROUTES = [
	{ path: "/", name: "landing" },
	{ path: "/pricing", name: "pricing" },
	{ path: "/blog", name: "blog" },
	{ path: "/blog/welcome", name: "blog post" },
	{ path: "/changelog", name: "changelog" },
	{ path: "/contact", name: "contact" },
	{ path: `/legal/${LEGAL_SLUG}`, name: "legal" },
	{ path: "/this-page-does-not-exist", name: "404" },
	{ path: "/blog/this-post-does-not-exist", name: "unknown blog post (404)" },
] as const;

const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
	test.describe(`accessibility — ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await page.addInitScript((value) => {
				try {
					localStorage.setItem("theme", value);
				} catch {
					// storage unavailable — the scan then runs in the default theme
				}
			}, theme);
		});

		for (const { path, name } of ROUTES) {
			test(`${name} has no wcag2a/aa violations`, async ({ page }) => {
				await page.goto(`/${DEFAULT_LOCALE}${path === "/" ? "" : path}`);
				await expect(page.locator("html")).toHaveClass(new RegExp(theme));
				await scrollThroughPage(page);
				const results = await new AxeBuilder({ page })
					.withTags(["wcag2a", "wcag2aa"])
					.analyze();
				expect(results.violations).toEqual([]);
			});
		}
	});
}

test("a blog post h2 has a top margin (prose styles apply)", async ({
	page,
}) => {
	await page.goto(`/${DEFAULT_LOCALE}/blog/welcome`);
	const marginTop = await page
		.locator("article h2")
		.first()
		.evaluate((el) => Number.parseFloat(getComputedStyle(el).marginTop));
	expect(marginTop).toBeGreaterThan(0);
});
