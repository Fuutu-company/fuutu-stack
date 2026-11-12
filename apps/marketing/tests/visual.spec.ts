import { expect, scrollThroughPage, test } from "./fixtures";
import { DEFAULT_LOCALE, LOCALES, OTHER_LOCALES } from "./locales";

/**
 * Visual regression tests for the marketing site.
 * Covers all pages in every enabled locale at desktop, tablet, and mobile viewports.
 *
 * Each viewport is shot by exactly one project class — desktop and tablet
 * on desktop-class projects (chromium/firefox/webkit), mobile on mobile
 * projects (mobile-safari/mobile-chrome). Without the `isMobile` skips,
 * every project would emit every viewport and each page+locale+viewport
 * combo would be doubled.
 *
 * Baselines are committed PNGs in .fuutu/visual-baselines/marketing/.
 * CI regenerates them on PRs and commits the diff back onto the
 * PR branch (plus on push to develop/main where allowed) —
 * see ../../.github/workflows/ci.yml. Locally, run --update-snapshots
 * to create your platform's baselines (gitignored outside linux).
 *
 * Snapshot names are category-prefixed (`category--slug-…`) so the
 * visual report can group pages by domain (marketing, legal,
 * component).
 */

const PAGES = [
	{ path: "", name: "marketing--landing" },
	{ path: "/pricing", name: "marketing--pricing" },
	{ path: "/blog", name: "marketing--blog" },
	{ path: "/blog/welcome", name: "marketing--blog-post" },
	{ path: "/changelog", name: "marketing--changelog" },
	{ path: "/contact", name: "marketing--contact" },
	{ path: "/legal/privacy", name: "legal--privacy" },
	{ path: "/legal/terms", name: "legal--terms" },
	{ path: "/legal/imprint", name: "legal--imprint" },
] as const;

const VIEWPORTS = [
	{ width: 1280, height: 720, label: "desktop" },
	{ width: 768, height: 1024, label: "tablet" },
	{ width: 375, height: 812, label: "mobile" },
] as const;

test.describe("visual regression — marketing pages", () => {
	// ── Desktop: every enabled locale ─────────────────────────────────

	for (const locale of LOCALES) {
		for (const { path, name } of PAGES) {
			test(`${locale} ${name} desktop matches baseline`, async ({
				page,
				isMobile,
			}) => {
				test.skip(isMobile, "desktop baselines are shot by desktop projects");
				await page.goto(`/${locale}${path}`);
				await page.waitForLoadState("domcontentloaded");
				await scrollThroughPage(page);
				await expect(page).toHaveScreenshot(`${name}-${locale}-desktop.png`, {
					fullPage: true,
				});
			});
		}
	}

	// ── Tablet + Mobile: key pages, default locale only ───────────────────────────
	// (Reduces snapshot count; other locales share the layout.)

	const KEY_PAGES = [
		{ path: "", name: "marketing--landing" },
		{ path: "/pricing", name: "marketing--pricing" },
		{ path: "/blog", name: "marketing--blog" },
		{ path: "/contact", name: "marketing--contact" },
	] as const;

	for (const viewport of VIEWPORTS) {
		if (viewport.label === "desktop") continue;

		for (const { path, name } of KEY_PAGES) {
			test(`${DEFAULT_LOCALE} ${name} ${viewport.label} matches baseline`, async ({
				page,
				isMobile,
			}) => {
				test.skip(
					viewport.label === "mobile" ? !isMobile : isMobile,
					`${viewport.label} baselines are shot by ${
						viewport.label === "mobile" ? "mobile" : "desktop"
					} projects`,
				);
				await page.setViewportSize({
					width: viewport.width,
					height: viewport.height,
				});
				await page.goto(`/${DEFAULT_LOCALE}${path}`);
				await page.waitForLoadState("domcontentloaded");
				await scrollThroughPage(page);
				await expect(page).toHaveScreenshot(
					`${name}-${DEFAULT_LOCALE}-${viewport.label}.png`,
					{ fullPage: true },
				);
			});
		}
	}
});

test.describe("visual regression — components", () => {
	test("locale switcher dropdown matches baseline", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Desktop navbar switcher is hidden on mobile");
		test.skip(
			OTHER_LOCALES.length === 0,
			"switcher is hidden with a single enabled locale",
		);
		await page.goto(`/${DEFAULT_LOCALE}`);
		await page.waitForLoadState("domcontentloaded");
		await page
			.getByRole("button", { name: /switch language/i })
			.first()
			.click();
		const menu = page.getByRole("menu");
		await expect(menu).toBeVisible();
		await expect(menu).toHaveScreenshot("component--locale-switcher.png");
	});

	test("mobile nav menu matches baseline", async ({ page, isMobile }) => {
		test.skip(!isMobile, "mobile nav baselines are shot by mobile projects");
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto(`/${DEFAULT_LOCALE}`);
		await page.waitForLoadState("domcontentloaded");
		const toggle = page.getByRole("button", { name: /toggle menu/i });
		await toggle.click();
		await expect(toggle).toHaveAttribute("aria-expanded", "true");
		await expect(page.locator("header").first()).toHaveScreenshot(
			"component--mobile-nav.png",
		);
	});
});
