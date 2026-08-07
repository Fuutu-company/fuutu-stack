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
});
