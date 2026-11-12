import { expect, test } from "./fixtures";

test.describe("auth flows", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("sign in with valid credentials reaches dashboard", async ({ page }) => {
		await page.goto("/auth/sign-in");

		await page.getByLabel("Email").fill("admin@fuutu.local");
		await page.getByLabel("Password").fill("DevPassword!2345");
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await expect(page).toHaveURL(/\/dashboard|\/onboarding/);
	});

	test("sign in with invalid credentials shows generic error", async ({
		page,
	}) => {
		await page.goto("/auth/sign-in");

		await page.getByLabel("Email").fill("admin@fuutu.local");
		await page.getByLabel("Password").fill("WrongPassword!9999");
		await page.getByRole("button", { name: "Sign in", exact: true }).click();

		await expect(page.getByText(/invalid email or password/i)).toBeVisible();
		await expect(page).toHaveURL(/\/auth\/sign-in/);
	});

	test("sign up form renders with required fields", async ({ page }) => {
		await page.goto("/auth/sign-up");

		await expect(page.getByLabel(/name/i)).toBeVisible();
		await expect(page.getByLabel("Email")).toBeVisible();
		await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
		await expect(page.getByLabel(/confirm password/i)).toBeVisible();
		await expect(
			page.getByRole("button", { name: /^sign up$/i }),
		).toBeVisible();
	});

	test("sign up with mismatched passwords shows error", async ({ page }) => {
		await page.goto("/auth/sign-up");

		await page.getByLabel(/name/i).fill("Test User");
		await page.getByLabel("Email").fill("testuser@example.com");
		await page
			.getByLabel("Password", { exact: true })
			.fill("TestPassword!2345");
		await page.getByLabel(/confirm password/i).fill("DifferentPassword!2345");
		await page.getByRole("button", { name: /^sign up$/i }).click();

		await expect(page.getByText(/passwords do not match/i)).toBeVisible();
	});

	test("forgot password page renders", async ({ page }) => {
		const response = await page.goto("/auth/forgot-password");
		expect(response?.status()).toBeLessThan(400);
	});

	// A provider without credentials (or disabled in authConfig) is not
	// registered by the server — its button must not render. Asserted against
	// the live server instead of the env, so it holds in any environment.
	for (const [provider, label] of [
		["google", "Sign in with Google"],
		["github", "Sign in with GitHub"],
	] as const) {
		test(`${provider} button renders exactly when the server registers ${provider}`, async ({
			page,
		}) => {
			await page.goto("/auth/sign-in");
			await expect(
				page.getByRole("button", { name: "Sign in", exact: true }),
			).toBeVisible();

			const status = await page.evaluate(async (id) => {
				const res = await fetch("/api/auth/sign-in/social", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						provider: id,
						callbackURL: "/dashboard",
						disableRedirect: true,
					}),
				});
				return res.status;
			}, provider);
			const registered = status !== 404;

			await expect(page.getByRole("button", { name: label })).toHaveCount(
				registered ? 1 : 0,
			);
		});
	}
});
