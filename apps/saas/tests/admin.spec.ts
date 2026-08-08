import { expect, test } from "./fixtures";

test.describe("admin user management", () => {
	test("admin dashboard page renders with management cards", async ({
		page,
	}) => {
		await page.goto("/admin");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		await expect(page.getByRole("heading", { name: /admin/i })).toBeVisible({
			timeout: 10_000,
		});

		// Admin dashboard links to user management
		await expect(
			page.getByRole("link", { name: /manage users/i }),
		).toBeVisible();
	});

	test("admin users page renders with user list table", async ({ page }) => {
		await page.goto("/admin/users");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		await expect(page.getByRole("heading", { name: /users/i })).toBeVisible({
			timeout: 10_000,
		});

		// User table headers
		await expect(
			page.getByRole("columnheader", { name: /email/i }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: /role/i }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: /status/i }),
		).toBeVisible();
	});

	test("admin can see ban/unban actions for seeded users", async ({ page }) => {
		await page.goto("/admin/users");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		// Wait for user table to populate (seeded users load via client)
		await expect(
			page.getByText(/admin@fuutu\.local|member@fuutu\.local/).first(),
		).toBeVisible({ timeout: 10_000 });

		// Ban/unban buttons use title attributes for accessibility
		// At least one ban or unban button should be present in the actions column
		await expect(
			page.getByRole("button", { name: /ban|unban/i }).first(),
		).toBeVisible();
	});

	test("admin can ban and unban a user, status badge updates", async ({
		page,
	}) => {
		await page.goto("/admin/users");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		// Wait for the member user row to appear
		const memberRow = page
			.getByRole("row")
			.filter({ hasText: /member@fuutu\.local/ });
		await expect(memberRow).toBeVisible({ timeout: 10_000 });

		// The seeded member starts as active — verify initial state
		await expect(memberRow.getByText(/active/i, { exact: true })).toBeVisible();
		const banButton = memberRow.getByRole("button", { name: /ban user/i });
		await expect(banButton).toBeVisible();

		// Ban the user
		await banButton.click();

		// Status badge flips to "Banned" and button aria-label to "Unban user"
		await expect(memberRow.getByText(/banned/i, { exact: true })).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			memberRow.getByRole("button", { name: /unban user/i }),
		).toBeVisible({ timeout: 10_000 });

		// Unban the user — restore original state for test isolation
		await memberRow.getByRole("button", { name: /unban user/i }).click();

		await expect(memberRow.getByText(/active/i, { exact: true })).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			memberRow.getByRole("button", { name: /ban user/i }),
		).toBeVisible({ timeout: 10_000 });
	});
});
