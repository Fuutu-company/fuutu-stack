import { expect, test } from "./fixtures";

test.describe("password reset flow", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("forgot-password page renders with email field", async ({ page }) => {
		await page.goto("/auth/forgot-password");

		await expect(
			page.getByRole("heading", { name: /forgot password/i }),
		).toBeVisible();
		await expect(page.getByLabel(/email/i)).toBeVisible();
		await expect(
			page.getByRole("button", { name: /send reset link/i }),
		).toBeVisible();
	});

	test("submitting email shows success message", async ({ page }) => {
		await page.goto("/auth/forgot-password");

		await page.getByLabel(/email/i).fill("admin@fuutu.local");
		await page.getByRole("button", { name: /send reset link/i }).click();

		await expect(page.getByText(/reset link has been sent/i)).toBeVisible();
	});

	test("reset-password page renders with new password fields", async ({
		page,
	}) => {
		await page.goto("/auth/reset-password?token=test");

		await expect(
			page.getByRole("heading", { name: /reset password/i }),
		).toBeVisible();
		await expect(page.getByLabel(/new password/i)).toBeVisible();
		await expect(page.getByLabel(/confirm password/i)).toBeVisible();
		await expect(
			page.getByRole("button", { name: /update password/i }),
		).toBeVisible();
	});

	test("reset-password page disables submit button without token", async ({
		page,
	}) => {
		await page.goto("/auth/reset-password");

		// Without a token, the submit button is disabled — the form can't be submitted
		const button = page.getByRole("button", { name: /update password/i });
		await expect(button).toBeVisible({ timeout: 10_000 });
		await expect(button).toBeDisabled();
	});
});
