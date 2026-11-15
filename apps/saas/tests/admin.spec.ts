import { expect, test } from "./fixtures";

const MEMBER_EMAIL = "member@fuutu.local";

test.describe("admin user management", () => {
	// The tests change the same seeded user (name, ban, impersonation).
	test.describe.configure({ mode: "serial" });

	test("/admin redirects to the users page server-side", async ({ page }) => {
		const response = await page.request.get("/admin", { maxRedirects: 0 });
		expect(response.status()).toBeGreaterThanOrEqual(300);
		expect(response.status()).toBeLessThan(400);
		expect(response.headers().location).toMatch(/\/admin\/users$/);

		await page.goto("/admin");
		await expect(page).toHaveURL(/\/admin\/users$/);
		await expect(
			page.getByRole("heading", { level: 1, name: /^users$/i }),
		).toBeAttached({ timeout: 10_000 });
	});

	test("admin users page renders with user list table", async ({ page }) => {
		await page.goto("/admin/users");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		await expect(
			page.getByRole("columnheader", { name: /user/i }).first(),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("columnheader", { name: /role/i }),
		).toBeVisible();
		await expect(
			page.getByRole("columnheader", { name: /status/i }),
		).toBeVisible();
	});

	test("lists seeded users and searches them via the URL", async ({ page }) => {
		await page.goto("/admin/users");
		await expect(
			page.getByRole("link", { name: /admin@fuutu\.local/ }),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("link", { name: /member@fuutu\.local/ }),
		).toBeVisible();

		await page
			.getByRole("searchbox", { name: /search users/i })
			.fill("member@");
		await expect(page).toHaveURL(/q=member%40/);
		await expect(
			page.getByRole("link", { name: /admin@fuutu\.local/ }),
		).toBeHidden();
		await expect(
			page.getByRole("link", { name: /member@fuutu\.local/ }),
		).toBeVisible();
	});

	test("user detail renders profile, badges and sections", async ({ page }) => {
		await page.goto("/admin/users?q=member@");
		await page.getByRole("link", { name: /member@fuutu\.local/ }).click();
		await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);

		await expect(
			page.getByRole("heading", { level: 2, name: /member user/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(MEMBER_EMAIL).first()).toBeVisible();
		await expect(
			page.getByText("Active", { exact: true }).first(),
		).toBeVisible();
		for (const tab of [
			/^overview/i,
			/^sessions/i,
			/^organizations/i,
			/^billing/i,
			/^api keys/i,
			/^activity/i,
		]) {
			await expect(page.getByRole("tab", { name: tab })).toBeVisible();
		}
		await expect(page.getByText(/sign-in methods/i)).toBeVisible();
	});

	test("admin cannot act on their own account", async ({ page }) => {
		await page.goto("/admin/users?q=admin@");
		await page.getByRole("link", { name: /admin@fuutu\.local/ }).click();
		await page.getByRole("button", { name: /^actions$/i }).click();
		await expect(page.getByRole("menuitem", { name: /^ban/i })).toBeDisabled();
		await expect(
			page.getByRole("menuitem", { name: /^impersonate/i }),
		).toBeDisabled();
		await expect(
			page.getByRole("menuitem", { name: /delete user/i }),
		).toBeDisabled();
	});

	test("admin can edit a user's name", async ({ page }) => {
		await page.goto("/admin/users?q=member@");
		await page.getByRole("link", { name: /member@fuutu\.local/ }).click();
		await expect(
			page.getByRole("heading", { level: 2, name: /member user/i }),
		).toBeVisible({ timeout: 10_000 });

		const rename = async (name: string) => {
			await page.getByRole("button", { name: /^actions$/i }).click();
			await page.getByRole("menuitem", { name: /edit name or email/i }).click();
			const dialog = page.getByRole("dialog");
			await dialog.getByLabel("Name").fill(name);
			await dialog.getByRole("button", { name: /save changes/i }).click();
			await expect(page.getByRole("heading", { level: 2, name })).toBeVisible({
				timeout: 10_000,
			});
		};

		await rename("Member Renamed");
		// Restore the seeded name for test isolation.
		await rename("Member User");
	});

	test("admin can ban with a reason and unban, status badge updates", async ({
		page,
	}) => {
		await page.goto("/admin/users?q=member@");
		await page.getByRole("link", { name: /member@fuutu\.local/ }).click();
		await expect(page.getByText("Active", { exact: true }).first()).toBeVisible(
			{
				timeout: 10_000,
			},
		);

		await page.getByRole("button", { name: /^actions$/i }).click();
		await page.getByRole("menuitem", { name: /^ban/i }).click();
		const dialog = page.getByRole("dialog");
		const confirm = dialog.getByRole("button", { name: /^ban user$/i });
		await expect(confirm).toBeDisabled();
		await dialog.getByLabel("Reason").fill("E2E ban check");
		await confirm.click();

		await expect(page.getByText("Banned permanently.")).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByText("Reason: E2E ban check")).toBeVisible();
		await expect(
			page.getByText("Banned", { exact: true }).first(),
		).toBeVisible();

		// Restore the original state for test isolation.
		await page.getByRole("button", { name: /^actions$/i }).click();
		await page.getByRole("menuitem", { name: /^unban/i }).click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: /^unban user$/i })
			.click();
		await expect(page.getByText("Banned permanently.")).toBeHidden({
			timeout: 10_000,
		});
		await expect(
			page.getByText("Active", { exact: true }).first(),
		).toBeVisible();
	});

	test("impersonation shows the banner and stop returns to the user detail", async ({
		page,
	}) => {
		await page.goto("/admin/users?q=member@");
		await page.getByRole("link", { name: /member@fuutu\.local/ }).click();
		await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);
		await expect(page.getByText(MEMBER_EMAIL).first()).toBeVisible({
			timeout: 10_000,
		});
		const detailUrl = page.url();

		await page.getByRole("button", { name: /^actions$/i }).click();
		await page.getByRole("menuitem", { name: /^impersonate/i }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Reason").fill("E2E impersonation check");
		await dialog.getByRole("button", { name: /^impersonate$/i }).click();

		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
		const banner = page.getByRole("status").filter({
			hasText: /you are impersonating/i,
		});
		await expect(banner).toBeVisible({ timeout: 10_000 });
		await expect(banner).toContainText(MEMBER_EMAIL);

		// The admin area stays closed while impersonating.
		await page.goto("/admin/users");
		await expect(page).toHaveURL(/\/dashboard/);

		await banner.getByRole("button", { name: /stop impersonating/i }).click();
		await expect(page).toHaveURL(detailUrl, { timeout: 15_000 });
		await expect(
			page.getByRole("heading", { level: 2, name: /member user/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("status").filter({ hasText: /you are impersonating/i }),
		).toBeHidden();
	});

	test("Better Auth admin endpoints are closed to direct HTTP", async ({
		request,
	}) => {
		const res = await request.post("/api/auth/admin/list-users", { data: {} });
		expect(res.status()).toBe(404);
	});
});
