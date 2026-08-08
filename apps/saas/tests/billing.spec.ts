import { expect, test } from "./fixtures";

test.describe("billing & checkout flows", () => {
	test("choose-plan page renders", async ({ page }) => {
		await page.goto("/choose-plan");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});

	test("can navigate from sidebar to choose-plan", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");

		await page
			.getByRole("link", { name: /billing/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/choose-plan/);
	});

	test("settings page renders for authenticated user", async ({ page }) => {
		await page.goto("/settings");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});
});
