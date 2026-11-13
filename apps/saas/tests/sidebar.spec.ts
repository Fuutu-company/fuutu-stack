import { expect, test } from "./fixtures";

test.describe("sidebar navigation", () => {
	test("sidebar is visible on dashboard", async ({ page, isMobile }) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");
		await expect(page.locator("[data-sidebar='sidebar']")).toBeVisible({
			timeout: 10_000,
		});
	});

	test("sidebar has navigation items", async ({ page, isMobile }) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");
		// Dashboard is a direct link
		await expect(
			page.getByRole("link", { name: /dashboard/i }).first(),
		).toBeVisible({ timeout: 10_000 });
		// AI Chat is a direct link (personal mode)
		await expect(
			page.getByRole("link", { name: /ai chat/i }).first(),
		).toBeVisible({ timeout: 10_000 });
	});

	test("sidebar trigger toggles sidebar", async ({ page, isMobile }) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		await expect(sidebar).toBeVisible({ timeout: 10_000 });

		const trigger = page.locator("[data-sidebar='trigger']");
		await trigger.click();

		const wrapper = page.locator("[data-state]").filter({
			has: sidebar,
		});
		await expect(wrapper).toHaveAttribute("data-state", "collapsed", {
			timeout: 10_000,
		});

		await trigger.click();
		await expect(wrapper).toHaveAttribute("data-state", "expanded", {
			timeout: 10_000,
		});
	});

	test("nav links navigate to correct pages", async ({ page, isMobile }) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");

		// Dashboard is a direct link
		await page
			.getByRole("link", { name: /dashboard/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/dashboard/);

		// Navigate to an org context — Organization group appears there
		await page.goto("/organizations/acme/dashboard");

		// "Settings" is a collapsible — expand it, then click "General" sub-link
		await page
			.getByRole("button", { name: /^settings$/i })
			.first()
			.click();
		await page
			.getByRole("link", { name: /general/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/organizations\/acme\/settings\/general/);
	});

	test("breadcrumb shows current page in header", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Breadcrumb hidden on mobile");
		await page.goto("/dashboard");
		await expect(page.locator("[aria-current='page']")).toHaveText(
			/dashboard/i,
			{ timeout: 10_000 },
		);
	});

	test("user dropdown menu opens with sign out", async ({ page, isMobile }) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");

		const footer = page.locator("[data-sidebar='footer']");

		// Wait for session to load — the button starts as a disabled skeleton
		await expect(footer.getByText(/@/)).toBeVisible({ timeout: 10_000 });

		await footer.getByRole("button").click();

		await expect(page.getByRole("menuitem", { name: /sign out/i })).toBeVisible(
			{ timeout: 10_000 },
		);
	});

	test("user menu billing link opens the Settings group and highlights Billing", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/organizations/acme/dashboard");

		const settingsGroup = page.locator("[data-nav-group='org-settings']");
		const groupTrigger = settingsGroup.getByRole("button", {
			name: /^settings$/i,
		});
		await expect(groupTrigger).toHaveAttribute("aria-expanded", "false", {
			timeout: 10_000,
		});

		const footer = page.locator("[data-sidebar='footer']");
		await expect(footer.getByText(/@/)).toBeVisible({ timeout: 10_000 });
		await footer.getByRole("button").click();
		await page.getByRole("menuitem", { name: /^billing$/i }).click();

		// Client-side navigation: no reload, the group must open by itself.
		await expect(page).toHaveURL(/\/organizations\/acme\/settings\/billing/);
		await expect(groupTrigger).toHaveAttribute("aria-expanded", "true", {
			timeout: 10_000,
		});
		await expect(
			settingsGroup.getByRole("link", { name: /^billing$/i }),
		).toHaveAttribute("aria-current", "page");
	});

	test("admin group expands and lists its sub-pages", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");

		const adminGroup = page.locator("[data-nav-group='admin']");
		const trigger = adminGroup.getByRole("button", { name: /^admin$/i });
		await expect(trigger).toHaveAttribute("aria-expanded", "false", {
			timeout: 10_000,
		});
		await trigger.click();

		await expect(
			adminGroup.getByRole("link", { name: /^overview$/i }),
		).toBeVisible();
		await expect(
			adminGroup.getByRole("link", { name: /^users$/i }),
		).toBeVisible();
		await expect(
			adminGroup.getByRole("link", { name: /^audit logs$/i }),
		).toBeVisible();

		await adminGroup.getByRole("link", { name: /^users$/i }).click();
		await expect(page).toHaveURL(/\/admin\/users/);
		await expect(
			adminGroup.getByRole("link", { name: /^users$/i }),
		).toHaveAttribute("aria-current", "page");
	});

	test("account group lists settings sections and highlights the active tab", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/settings?tab=security");

		const accountGroup = page.locator("[data-nav-group='account-settings']");
		await expect(
			accountGroup.getByRole("link", { name: /^security$/i }),
		).toHaveAttribute("aria-current", "page", { timeout: 10_000 });
		await expect(
			accountGroup.getByRole("link", { name: /^profile$/i }),
		).not.toHaveAttribute("aria-current", "page");
	});

	test("settings pages render no duplicate in-page tab navigation", async ({
		page,
	}) => {
		const urls = [
			"/settings",
			"/settings?tab=security",
			"/settings/api-keys",
			"/organizations/acme/settings/general",
			"/organizations/acme/settings/members",
			"/organizations/acme/settings/billing",
			"/organizations/acme/settings/api-keys",
		];
		for (const url of urls) {
			await page.goto(url);
			await expect(page.getByRole("heading").first()).toBeVisible({
				timeout: 10_000,
			});
			await expect(page.getByRole("tab")).toHaveCount(0);
			// The breadcrumb is a labelled <nav>; the removed tab nav had no label.
			await expect(page.locator("main nav:not([aria-label])")).toHaveCount(0);
		}
	});
});
