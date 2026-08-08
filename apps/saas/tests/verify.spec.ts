import { expect, test } from "./fixtures";

test.describe("email verification", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("verify page renders with idle state", async ({ page }) => {
		await page.goto("/auth/verify");

		await expect(
			page.getByRole("heading", { name: /verify your email/i }),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: /back to sign in/i }),
		).toBeVisible();
	});

	test("verify page shows error state with invalid token", async ({ page }) => {
		await page.goto("/auth/verify?token=invalid");

		await expect(page.getByText(/verification failed/i)).toBeVisible();
	});
});
