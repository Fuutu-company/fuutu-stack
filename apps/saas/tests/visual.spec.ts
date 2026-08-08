import { expect, test } from "./fixtures";

test.describe("visual regression — auth pages", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("sign-in page matches baseline", async ({ page }) => {
		await page.goto("/auth/sign-in");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth-sign-in.png", {
			fullPage: true,
			mask: [page.getByRole("form")],
		});
	});

	test("sign-up page matches baseline", async ({ page }) => {
		await page.goto("/auth/sign-up");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth-sign-up.png", {
			fullPage: true,
			mask: [page.getByRole("form")],
		});
	});

	test("forgot-password page matches baseline", async ({ page }) => {
		await page.goto("/auth/forgot-password");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth-forgot-password.png", {
			fullPage: true,
		});
	});
});

test.describe("visual regression — app pages", () => {
	test("dashboard matches baseline", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("dashboard.png", {
			fullPage: true,
		});
	});

	test("organizations list matches baseline", async ({ page }) => {
		await page.goto("/organizations");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("organizations.png", {
			fullPage: true,
		});
	});

	test("choose-plan matches baseline", async ({ page }) => {
		await page.goto("/choose-plan");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("choose-plan.png", {
			fullPage: true,
		});
	});

	test("settings matches baseline", async ({ page }) => {
		await page.goto("/settings");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("settings.png", {
			fullPage: true,
		});
	});

	test("admin matches baseline", async ({ page }) => {
		await page.goto("/admin");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("admin.png", {
			fullPage: true,
		});
	});

	test("chat matches baseline", async ({ page }) => {
		await page.goto("/chat");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("chat.png", {
			fullPage: true,
		});
	});

	test("crm matches baseline", async ({ page }) => {
		await page.goto("/crm");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("crm.png", {
			fullPage: true,
		});
	});
});
