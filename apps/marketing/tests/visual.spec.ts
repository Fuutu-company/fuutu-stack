import { expect, scrollThroughPage, test } from "./fixtures";

/**
 * Visual regression tests for the marketing site.
 * Covers all pages in EN + DE at desktop, tablet, and mobile viewports.
 *
 * Baselines are auto-generated on first run (--update-snapshots).
 * CI caches baselines per branch — see ../../.github/workflows/ci.yml.
 */

const PAGES = [
	{ path: "", name: "landing" },
	{ path: "/pricing", name: "pricing" },
	{ path: "/blog", name: "blog" },
	{ path: "/changelog", name: "changelog" },
	{ path: "/contact", name: "contact" },
	{ path: "/legal/privacy", name: "privacy" },
] as const;

const VIEWPORTS = [
	{ width: 1280, height: 720, label: "desktop" },
	{ width: 768, height: 1024, label: "tablet" },
	{ width: 375, height: 812, label: "mobile" },
] as const;

test.describe("visual regression — marketing pages", () => {
	// ── Desktop: EN + DE ──────────────────────────────────────────────

	for (const { path, name } of PAGES) {
		test(`en ${name} desktop matches baseline`, async ({ page }) => {
			await page.goto(`/en${path}`);
			await page.waitForLoadState("domcontentloaded");
			await scrollThroughPage(page);
			await expect(page).toHaveScreenshot(`${name}-en-desktop.png`, {
				fullPage: true,
			});
		});

		test(`de ${name} desktop matches baseline`, async ({ page }) => {
			await page.goto(`/de${path}`);
			await page.waitForLoadState("domcontentloaded");
			await scrollThroughPage(page);
			await expect(page).toHaveScreenshot(`${name}-de-desktop.png`, {
				fullPage: true,
			});
		});
	}

	// ── Tablet + Mobile: key pages, EN only ───────────────────────────
	// (Reduces snapshot count; DE layout is identical to EN.)

	const KEY_PAGES = [
		{ path: "", name: "landing" },
		{ path: "/pricing", name: "pricing" },
		{ path: "/blog", name: "blog" },
		{ path: "/contact", name: "contact" },
	] as const;

	for (const viewport of VIEWPORTS) {
		if (viewport.label === "desktop") continue;

		for (const { path, name } of KEY_PAGES) {
			test(`en ${name} ${viewport.label} matches baseline`, async ({
				page,
			}) => {
				await page.setViewportSize({
					width: viewport.width,
					height: viewport.height,
				});
				await page.goto(`/en${path}`);
				await page.waitForLoadState("domcontentloaded");
				await scrollThroughPage(page);
				await expect(page).toHaveScreenshot(
					`${name}-en-${viewport.label}.png`,
					{ fullPage: true },
				);
			});
		}
	}
});
