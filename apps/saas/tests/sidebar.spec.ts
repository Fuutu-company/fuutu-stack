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

		await expect(adminGroup.getByRole("link")).toHaveText([
			/^users$/i,
			/^audit logs$/i,
		]);
		await expect(
			adminGroup.getByRole("link", { name: /overview/i }),
		).toHaveCount(0);

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

	test("active nav item renders as ink pill", async ({ page, isMobile }) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");

		/** Computed fill/ink of `el` and the resolved `--sidebar-primary(-foreground)` in the same scope. */
		const inkOf = (el: Element) => {
			const probe = document.createElement("div");
			probe.style.backgroundColor = "var(--sidebar-primary)";
			probe.style.color = "var(--sidebar-primary-foreground)";
			el.parentElement?.appendChild(probe);
			const expected = getComputedStyle(probe);
			const actual = getComputedStyle(el);
			const result = {
				background: actual.backgroundColor,
				color: actual.color,
				primary: expected.backgroundColor,
				primaryForeground: expected.color,
				pill:
					Number.parseFloat(actual.borderTopLeftRadius) >=
					(el as HTMLElement).offsetHeight / 2,
			};
			probe.remove();
			return result;
		};

		await page.goto("/dashboard");
		const sidebar = page.locator("[data-sidebar='sidebar']");
		const dashboard = sidebar.getByRole("link", { name: /^dashboard$/i });
		await expect(dashboard).toHaveAttribute("data-active", "true", {
			timeout: 10_000,
		});
		const active = await dashboard.evaluate(inkOf);
		expect(active.background).toBe(active.primary);
		expect(active.color).toBe(active.primaryForeground);
		expect(active.pill).toBe(true);

		const inactive = await sidebar
			.getByRole("link", { name: /^notifications$/i })
			.evaluate(inkOf);
		expect(inactive.background).not.toBe(inactive.primary);

		await page.goto("/settings?tab=security");
		const security = page
			.locator("[data-nav-group='account-settings']")
			.getByRole("link", { name: /^security$/i });
		await expect(security).toHaveAttribute("aria-current", "page", {
			timeout: 10_000,
		});
		const sub = await security.evaluate(inkOf);
		expect(sub.background).toBe(sub.primary);
		expect(sub.color).toBe(sub.primaryForeground);
		expect(sub.pill).toBe(true);
	});

	test("nav icons and sub-items are plain: no area circles, no marker dots", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/organizations/acme/settings/members");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		const settingsGroup = page.locator("[data-nav-group='org-settings']");
		await expect(
			settingsGroup.getByRole("link", { name: /^members$/i }),
		).toHaveAttribute("aria-current", "page", { timeout: 10_000 });

		await expect(sidebar.locator("[data-slot='area-icon']")).toHaveCount(0);
		await expect(sidebar.locator("[data-slot='nav-area-dot']")).toHaveCount(0);

		// Every top-level icon is a direct child of its button, same size and ink.
		const names = [/^ai chat$/i, /^crm$/i, /^notifications$/i];
		const icons = await Promise.all(
			names.map((name) =>
				sidebar
					.getByRole("link", { name })
					.locator(":scope > svg")
					.evaluate((el) => {
						const box = el.getBoundingClientRect();
						return {
							size: `${box.width}x${box.height}`,
							color: getComputedStyle(el).color,
							background: getComputedStyle(el.parentElement as Element)
								.backgroundColor,
						};
					}),
			),
		);
		expect(new Set(icons.map((i) => i.size)).size).toBe(1);
		expect(new Set(icons.map((i) => i.color)).size).toBe(1);
		expect(new Set(icons.map((i) => i.background)).size).toBe(1);

		// Sub-items hold the label only — nothing in front of it.
		const subLinks = settingsGroup.locator("[data-sidebar='menu-sub-button']");
		await expect(subLinks).not.toHaveCount(0);
		for (const link of await subLinks.all()) {
			await expect(link.locator(":scope > *")).toHaveCount(1);
		}
	});

	test("sidebar scroll area is soft: thin, borderless, no native track", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.setViewportSize({ width: 1280, height: 420 });
		await page.goto("/dashboard");
		const content = page.locator("[data-sidebar='content']");
		await expect(content).toBeVisible({ timeout: 10_000 });
		await expect(content).toHaveClass(/scrollbar-soft/);
		const style = await content.evaluate((el) => {
			const cs = getComputedStyle(el);
			const thumb = getComputedStyle(el, "::-webkit-scrollbar");
			return {
				borderLeft: cs.borderLeftWidth,
				borderRight: cs.borderRightWidth,
				overflowY: cs.overflowY,
				thumbWidth: thumb.width,
				scrollbarWidth: cs.scrollbarWidth,
			};
		});
		expect(style.borderLeft).toBe("0px");
		expect(style.borderRight).toBe("0px");
		expect(style.overflowY).toBe("auto");
		expect(["6px", "thin"]).toContain(
			style.thumbWidth === "6px" ? "6px" : style.scrollbarWidth,
		);
	});
});
