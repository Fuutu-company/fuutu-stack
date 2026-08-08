import { expect, test } from "./fixtures";

test.describe("dashboard page — personal mode", () => {
	test("dashboard page loads without auth redirect", async ({ page }) => {
		await page.goto("/dashboard");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});

	test("dashboard renders with stats overview", async ({ page }) => {
		await page.goto("/dashboard");

		await expect(page.getByText(/auth events/i).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/plans configured/i).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/providers swappable/i).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/locales shipped/i).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("dashboard shows recent activity section", async ({ page }) => {
		await page.goto("/dashboard");

		await expect(
			page.getByRole("heading", { name: /recent activity/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("dashboard shows quick actions section", async ({ page }) => {
		await page.goto("/dashboard");

		await expect(
			page.getByRole("heading", { name: /quick actions/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("stats cards have numeric values", async ({ page }) => {
		await page.goto("/dashboard");

		const statLabels = [
			"Auth events",
			"Plans configured",
			"Providers swappable",
			"Locales shipped",
		];

		for (const label of statLabels) {
			const card = page
				.getByTestId("stat-card")
				.filter({ hasText: label })
				.first();
			await expect(card).toBeVisible({ timeout: 10_000 });

			const value = card.getByTestId("stat-value");
			await expect(value).not.toBeEmpty({ timeout: 10_000 });
			const text = await value.textContent();
			expect(text).toBeTruthy();
			expect(text?.trim().length).toBeGreaterThan(0);
		}
	});
});

test.describe("dashboard page — org mode", () => {
	test("org dashboard renders with stats overview", async ({ page }) => {
		await page.goto("/organizations/acme/dashboard");

		await expect(page.getByText(/auth events/i).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/plans configured/i).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/providers swappable/i).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText(/locales shipped/i).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("org dashboard shows recent activity section", async ({ page }) => {
		await page.goto("/organizations/acme/dashboard");

		await expect(
			page.getByRole("heading", { name: /recent activity/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("org dashboard shows quick actions section", async ({ page }) => {
		await page.goto("/organizations/acme/dashboard");

		await expect(
			page.getByRole("heading", { name: /quick actions/i }),
		).toBeVisible({ timeout: 10_000 });
	});
});
