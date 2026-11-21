import { isKitRouteEnabled } from "../src/lib/kit-routes";
import { expect, test } from "./fixtures";
import { DEFAULT_LOCALE } from "./locales";

/**
 * `/download` exists only with the desktop app on
 * (`config.features.desktop`); it reads the current release from the saas
 * app (`GET /api/desktop/download`) and works without one.
 */
test.describe("download page", () => {
	test("is gone while the desktop app is off", async ({ page }) => {
		test.skip(isKitRouteEnabled("download"), "desktop app is on");
		const res = await page.goto(`/${DEFAULT_LOCALE}/download`);
		expect(res?.status()).toBe(404);
	});

	test("renders the download page", async ({ page }) => {
		test.skip(!isKitRouteEnabled("download"), "desktop app is off");
		const res = await page.goto(`/${DEFAULT_LOCALE}/download`);
		expect(res?.status()).toBe(200);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		// Either installers or the "not available yet" note — never an error.
		await expect(
			page.locator("main a[href*='/api/desktop/download/'], main p").first(),
		).toBeVisible();
	});
});
