import type { Page } from "@playwright/test";
import {
	DEFAULT_LOCALE,
	expect,
	LOCALES,
	localePrefix,
	test,
} from "./fixtures";

/**
 * Smoke tests for the docs site: home, the docs layout (sidebar + table of
 * contents), unknown pages and console errors. Assertions check structure,
 * not wording, so they survive replacing the demo content.
 */

/**
 * The docs sidebar: the desktop column, or on phones the drawer behind the
 * sidebar toggle (fumadocs renders `#nd-sidebar-mobile` once it opens).
 */
async function openSidebar(page: Page, isMobile: boolean) {
	if (!isMobile) return page.locator("#nd-sidebar");
	await page
		.locator('button[aria-controls="nd-sidebar-mobile"]')
		.first()
		.click();
	return page.locator("#nd-sidebar-mobile");
}

/** Opens the first nested docs page through the sidebar (folders start collapsed). */
async function openNestedPageFromSidebar(page: Page, isMobile: boolean) {
	const sidebar = await openSidebar(page, isMobile);
	await expect(sidebar.locator('a[href*="/docs"]').first()).toBeVisible();
	const nested = sidebar.locator('a[href*="/docs/"]');
	if ((await nested.count()) === 0) {
		// A collapsed folder — not a popover trigger like the language switch.
		await sidebar
			.locator('button[aria-expanded="false"]:not([aria-haspopup])')
			.first()
			.click();
	}
	await nested.first().click();
	await expect(page).toHaveURL(/\/docs\/.+/);
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
}

test.describe("page loads", () => {
	test("docs home returns 200 and links into the docs", async ({ page }) => {
		const res = await page.goto("/");
		expect(res?.status()).toBe(200);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		await expect(page.locator('main a[href$="/docs"]').first()).toBeVisible();
	});

	for (const locale of LOCALES) {
		test(`${locale}: /docs returns 200 — every enabled locale`, async ({
			page,
		}) => {
			const res = await page.goto(`${localePrefix(locale)}/docs`);
			expect(res?.status()).toBe(200);
			await expect(page.locator("html")).toHaveAttribute("lang", locale);
		});
	}
});

test.describe("docs layout", () => {
	test("a docs page renders the sidebar and the table of contents", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/docs");
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

		const sidebar = await openSidebar(page, isMobile);
		await expect(sidebar.locator('a[href*="/docs"]').first()).toBeVisible();
		const tocLinks = page.locator('#nd-toc a[href^="#"]');
		// Desktop shows the TOC column; on phones it sits behind a popover.
		if (isMobile) await expect(tocLinks.first()).toBeAttached();
		else await expect(tocLinks.first()).toBeVisible();
	});

	test("a sidebar link opens another docs page", async ({ page, isMobile }) => {
		await page.goto("/docs");
		await openNestedPageFromSidebar(page, isMobile);
	});
});

test.describe("not found", () => {
	for (const path of [
		"/docs/this-page-does-not-exist",
		`/${DEFAULT_LOCALE}/docs/getting-started/this-page-does-not-exist`,
	]) {
		test(`unknown doc ${path} answers 404`, async ({ page }) => {
			const res = await page.goto(path);
			expect(res?.status()).toBe(404);
		});
	}
});

test.describe("console", () => {
	test("home, docs pages and the 404 page log no console errors", async ({
		page,
		consoleErrors,
		isMobile,
	}) => {
		for (const path of ["/", "/docs/this-page-does-not-exist", "/docs"]) {
			await page.goto(path);
			await page.waitForLoadState("load");
		}
		await openNestedPageFromSidebar(page, isMobile);
		// Link prefetches run after load — wait until they have answered.
		await page.waitForLoadState("networkidle");
		expect(consoleErrors).toEqual([]);
	});
});
