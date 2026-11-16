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

	test("a reset link with an unknown token offers a new link instead of the form", async ({
		page,
	}) => {
		// Regression: any `?token=` showed the form; only the submit failed.
		await page.goto("/auth/reset-password?token=test");

		await expect(
			page.getByRole("heading", { name: /reset password/i }),
		).toBeVisible();
		await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
		await expect(page.getByLabel(/new password/i)).toBeHidden();
		await page.getByRole("link", { name: /request a new link/i }).click();
		await expect(page).toHaveURL(/\/auth\/forgot-password$/);
	});

	test("reset-password page without a token says the link is invalid", async ({
		page,
	}) => {
		await page.goto("/auth/reset-password");

		await expect(page.getByText(/invalid or has expired/i)).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			page.getByRole("button", { name: /update password/i }),
		).toBeHidden();
	});

	test("an expired link Better Auth bounced shows the same state", async ({
		page,
	}) => {
		await page.goto("/auth/reset-password?error=INVALID_TOKEN");
		await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
	});

	test("Better Auth's reset link endpoint lands an unknown token on that state", async ({
		page,
	}) => {
		await page.goto(
			"/api/auth/reset-password/not-a-token?callbackURL=/auth/reset-password",
		);
		await expect(page).toHaveURL(/error=INVALID_TOKEN/);
		await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
	});
});

test.describe("email change link", () => {
	test("a bogus link never reports a successful change", async ({ page }) => {
		// Regression: `?token=bogus` said "Your email has been updated".
		await page.goto("/auth/verify-email-change?token=bogus");
		await expect(page.getByText(/verification failed/i)).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/updated successfully/i)).toHaveCount(0);
	});

	test("a link Better Auth rejected shows the error", async ({ page }) => {
		await page.goto(
			"/api/auth/verify-email?token=bogus&callbackURL=%2Fauth%2Fverify-email-change%3Femail%3Dnew%2540fuutu.local",
		);
		await expect(page).toHaveURL(/verify-email-change.*error=/);
		await expect(page.getByText(/verification failed/i)).toBeVisible();
		await expect(page.getByText(/updated successfully/i)).toHaveCount(0);
	});
});
