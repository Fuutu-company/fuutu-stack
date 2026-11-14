import { expect, type Page, test } from "@playwright/test";

// Base Playwright `test` on purpose: the shared fixture pre-accepts consent,
// this spec needs the banner on screen.

const banner = (page: Page) => page.getByRole("dialog", { name: /analytics/i });

async function bannerShown(page: Page): Promise<boolean> {
	return banner(page)
		.waitFor({ state: "visible", timeout: 5_000 })
		.then(() => true)
		.catch(() => false);
}

/** How far the page scrolls past the viewport. */
function overflow(page: Page): Promise<number> {
	return page.evaluate(
		() => (document.scrollingElement?.scrollHeight ?? 0) - window.innerHeight,
	);
}

/**
 * Scrolled to the very end, the last content element sits above the banner
 * (the banner reserves room on pages that scroll).
 */
async function endClearsBanner(page: Page, selector: string): Promise<boolean> {
	return page.evaluate((selector) => {
		window.scrollTo(0, document.scrollingElement?.scrollHeight ?? 0);
		const end = [...document.querySelectorAll(selector)].at(-1);
		const bannerEl = document.querySelector('[role="dialog"]');
		if (!end || !bannerEl) throw new Error(`missing ${selector} or banner`);
		return (
			end.getBoundingClientRect().bottom <=
			bannerEl.getBoundingClientRect().top + 1
		);
	}, selector);
}

test.describe("consent banner scroll room", () => {
	// Signed out: the auth pages would otherwise redirect to the dashboard.
	test.use({ storageState: { cookies: [], origins: [] } });

	test("adds no scroll room on sign-in at 1280px when it fits", async ({
		page,
	}) => {
		// At this size the sign-in page fits without scrolling.
		await page.setViewportSize({ width: 1280, height: 873 });
		await page.goto("/auth/sign-in");
		test.skip(
			!(await bannerShown(page)),
			"Consent banner disabled in this environment",
		);
		// Regression: the banner's spacer used to make a full-height page
		// taller than the viewport, so it scrolled into blank space and
		// "lost" that scroll once consent was given.
		await expect.poll(() => overflow(page)).toBeLessThanOrEqual(1);
	});

	test("follows client-side navigation between long and short pages", async ({
		page,
	}) => {
		// At 1280×720 sign-in is taller than the viewport, forgot-password
		// fits. The banner lives in the layout and survives navigation, so
		// its room must be recomputed per page.
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.goto("/auth/sign-in");
		test.skip(
			!(await bannerShown(page)),
			"Consent banner disabled in this environment",
		);
		const formEnd = "form button[type='submit']";
		await expect.poll(() => endClearsBanner(page, formEnd)).toBe(true);

		// Long → short: no blank scroll room left behind.
		await page.getByRole("link", { name: /forgot your password/i }).click();
		await expect(page).toHaveURL(/\/auth\/forgot-password/);
		await expect(banner(page)).toBeVisible();
		await expect.poll(() => overflow(page)).toBeLessThanOrEqual(1);

		// Short → long: the end of the page scrolls clear of the banner again.
		await page.getByRole("link", { name: /^sign in$/i }).click();
		await expect(page).toHaveURL(/\/auth\/sign-in/);
		await expect.poll(() => endClearsBanner(page, formEnd)).toBe(true);
	});

	test("reserves room when content grows after load, and drops it again", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 1280, height: 873 });
		await page.goto("/auth/sign-in");
		test.skip(
			!(await bannerShown(page)),
			"Consent banner disabled in this environment",
		);
		await expect.poll(() => overflow(page)).toBeLessThanOrEqual(1);

		// Late-loading content makes the page scroll: its end must clear
		// the banner.
		await page.evaluate(() => {
			const late = document.createElement("div");
			late.id = "late-content";
			late.style.height = "600px";
			// Last element of the page content: the form's outermost
			// rendered ancestor (the auth layout wrapper).
			let wrapper = document.querySelector("form") as HTMLElement | null;
			while (
				wrapper?.parentElement &&
				wrapper.parentElement !== document.body &&
				wrapper.parentElement.getBoundingClientRect().height > 0
			) {
				wrapper = wrapper.parentElement;
			}
			wrapper?.append(late);
		});
		await expect.poll(() => endClearsBanner(page, "#late-content")).toBe(true);

		// …and once it is gone the page fits again, without blank room.
		await page.evaluate(() =>
			document.getElementById("late-content")?.remove(),
		);
		await expect.poll(() => overflow(page)).toBeLessThanOrEqual(1);
	});
});
