import { expect, test } from "./fixtures";

const SEEDED_ADMIN_NAME = "Admin User";

test.describe("onboarding flow", () => {
	test.afterEach(async ({ request }) => {
		await request.post("/api/auth/update-user", {
			data: { name: SEEDED_ADMIN_NAME },
		});
	});

	test("onboarding page is accessible for authenticated user", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);
	});

	test("onboarding page renders with welcome heading", async ({ page }) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		await expect(
			page.getByRole("heading", { name: /welcome to fuutu/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("onboarding has profile setup form with name input and continue button", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		// Profile step: full name input labeled "Full name"
		await expect(page.getByLabel(/full name/i)).toBeVisible({
			timeout: 10_000,
		});

		// Continue button to proceed to org step
		await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
	});

	test("onboarding profile step transitions to org step on continue", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		// Fill in the name field
		const nameInput = page.getByLabel(/full name/i);
		await expect(nameInput).toBeVisible({ timeout: 10_000 });
		await nameInput.fill("Test Onboarding User");

		// Click continue — calls authClient.updateUser, then advances to org step
		await page.getByRole("button", { name: /continue/i }).click();

		// Org step renders "Skip for now" and "Create organization" buttons
		await expect(
			page.getByRole("button", { name: /skip for now/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("button", { name: /create organization/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("onboarding org step can be skipped to reach done step", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		// Profile step — fill name and continue
		const nameInput = page.getByLabel(/full name/i);
		await expect(nameInput).toBeVisible({ timeout: 10_000 });
		await nameInput.fill("Test Onboarding User");
		await page.getByRole("button", { name: /continue/i }).click();

		// Org step — skip
		await expect(
			page.getByRole("button", { name: /skip for now/i }),
		).toBeVisible({ timeout: 10_000 });
		await page.getByRole("button", { name: /skip for now/i }).click();

		// Done step — "Go to dashboard" button appears
		await expect(
			page.getByRole("button", { name: /go to dashboard/i }),
		).toBeVisible({ timeout: 10_000 });
	});
});
