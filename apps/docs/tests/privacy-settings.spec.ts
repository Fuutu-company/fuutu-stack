import { expect, type Page, test } from "@playwright/test";

// Base Playwright `test` on purpose: the shared fixture pre-accepts consent,
// this spec needs the banner on screen first.

const banner = (page: Page) => page.getByRole("dialog", { name: /analytics/i });

/** Shown on first visit, then answered (OK in notice mode, Accept in consent mode). */
async function answerBanner(page: Page): Promise<boolean> {
	const shown = await banner(page)
		.waitFor({ state: "visible", timeout: 5_000 })
		.then(() => true)
		.catch(() => false);
	if (!shown) return false;
	await banner(page)
		.getByRole("button", { name: /^(ok|accept)$/i })
		.click();
	await expect(banner(page)).toBeHidden();
	return true;
}

test.describe("privacy settings", () => {
	test("the docs sidebar footer reopens the consent banner", async ({
		page,
		isMobile,
	}) => {
		await page.goto("/docs");
		test.skip(!(await answerBanner(page)), "Consent banner disabled");

		if (isMobile) {
			await page
				.locator('button[aria-controls="nd-sidebar-mobile"]')
				.first()
				.click();
		}
		const sidebar = page.locator(
			isMobile ? "#nd-sidebar-mobile" : "#nd-sidebar",
		);
		await sidebar.getByRole("button", { name: /^privacy settings$/i }).click();
		await expect(banner(page)).toBeVisible();
	});

	test("the docs home footer reopens the consent banner", async ({ page }) => {
		await page.goto("/");
		test.skip(!(await answerBanner(page)), "Consent banner disabled");

		await page
			.locator("footer")
			.getByRole("button", { name: /^privacy settings$/i })
			.click();
		await expect(banner(page)).toBeVisible();
	});
});
