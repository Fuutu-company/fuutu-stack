import { expect, test } from "./fixtures";

test.describe("two-factor authentication", () => {
	test("settings page has 2FA section", async ({ page }) => {
		await page.goto("/settings");

		await expect(
			page.getByRole("heading", { name: /settings/i }),
		).toBeVisible();
		await expect(page.getByRole("tab", { name: /security/i })).toBeVisible();
	});

	test("2FA section is visible on the security tab", async ({ page }) => {
		await page.goto("/settings");

		await page.getByRole("tab", { name: /security/i }).click();

		await expect(
			page.getByRole("heading", { name: /two-factor authentication/i }),
		).toBeVisible();
	});

	test("2FA enable or disable button is visible", async ({ page }) => {
		await page.goto("/settings");

		await page.getByRole("tab", { name: /security/i }).click();

		await expect(
			page.getByRole("heading", { name: /two-factor authentication/i }),
		).toBeVisible();

		const enableButton = page.getByRole("button", { name: /enable 2fa/i });
		const disableButton = page.getByRole("button", { name: /disable 2fa/i });

		await expect(enableButton.or(disableButton)).toBeVisible();
	});
});
