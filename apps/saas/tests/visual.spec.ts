import { expect, test } from "./fixtures";

/**
 * Visual regression tests for the SaaS app.
 * Baselines are committed PNGs in .fuutu/visual-baselines/saas/ —
 * CI regenerates them on PRs and commits the diff back onto the
 * PR branch (plus on push to develop/main where allowed).
 *
 * Snapshot names are category-prefixed (`category--slug.png`) so the
 * visual report can group pages by domain (auth, core, settings,
 * admin, org, dialog, component).
 *
 * Deliberately not covered — pages that need complex state to render
 * meaningfully:
 * - /auth/reset-password?token=… and /auth/verify?token=… valid-token
 *   states (require a real emailed token — we snapshot the no-token
 *   fallback state instead)
 * - onboarding steps 2+ (multi-step wizard state persisted server-side)
 * - checkout / payment success routes (require provider redirect state)
 * - org chat/crm variants under /organizations/acme/* (same UI as the
 *   personal /chat + /crm routes already covered below)
 */

test.describe("visual regression — auth pages", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("sign-in page matches baseline", async ({ page }) => {
		await page.goto("/auth/sign-in");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth--sign-in.png", {
			fullPage: true,
			mask: [page.getByRole("form")],
		});
	});

	test("sign-up page matches baseline", async ({ page }) => {
		await page.goto("/auth/sign-up");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth--sign-up.png", {
			fullPage: true,
			mask: [page.getByRole("form")],
		});
	});

	test("forgot-password page matches baseline", async ({ page }) => {
		await page.goto("/auth/forgot-password");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth--forgot-password.png", {
			fullPage: true,
		});
	});

	test("reset-password page matches baseline", async ({ page }) => {
		// No-token state — token-gated form requires a real emailed token.
		await page.goto("/auth/reset-password");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth--reset-password.png", {
			fullPage: true,
		});
	});

	test("verify page matches baseline", async ({ page }) => {
		// No-token state — verification needs a real emailed token.
		await page.goto("/auth/verify");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth--verify.png", {
			fullPage: true,
		});
	});

	test("suspended page matches baseline", async ({ page }) => {
		await page.goto("/auth/suspended");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("auth--suspended.png", {
			fullPage: true,
		});
	});
});

test.describe("visual regression — app pages", () => {
	test("dashboard matches baseline", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("core--dashboard.png", {
			fullPage: true,
		});
	});

	test("organizations list matches baseline", async ({ page }) => {
		await page.goto("/organizations");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("core--organizations.png", {
			fullPage: true,
		});
	});

	test("choose-plan matches baseline", async ({ page }) => {
		await page.goto("/choose-plan");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("core--choose-plan.png", {
			fullPage: true,
		});
	});

	test("onboarding matches baseline", async ({ page }) => {
		await page.goto("/onboarding");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("core--onboarding.png", {
			fullPage: true,
		});
	});

	test("notifications matches baseline", async ({ page }) => {
		await page.goto("/notifications");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("core--notifications.png", {
			fullPage: true,
		});
	});

	test("settings matches baseline", async ({ page }) => {
		await page.goto("/settings");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("core--settings.png", {
			fullPage: true,
		});
	});

	test("settings api-keys matches baseline", async ({ page }) => {
		await page.goto("/settings/api-keys");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("settings--api-keys.png", {
			fullPage: true,
		});
	});

	test("settings billing matches baseline", async ({ page }) => {
		await page.goto("/settings/billing");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("settings--billing.png", {
			fullPage: true,
		});
	});

	test("settings credits matches baseline", async ({ page }) => {
		await page.goto("/settings/credits");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("settings--credits.png", {
			fullPage: true,
		});
	});

	test("admin matches baseline", async ({ page }) => {
		await page.goto("/admin");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("admin--admin.png", {
			fullPage: true,
		});
	});

	test("admin users matches baseline", async ({ page }) => {
		await page.goto("/admin/users");
		await page.waitForLoadState("domcontentloaded");
		// User table loads client-side — wait for a real row so the
		// baseline captures the populated table, not the skeleton.
		await expect(
			page.getByText(/admin@fuutu\.local|member@fuutu\.local/).first(),
		).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("admin--users.png", {
			fullPage: true,
		});
	});

	test("admin audit-logs matches baseline", async ({ page }) => {
		await page.goto("/admin/audit-logs");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("admin--audit-logs.png", {
			fullPage: true,
		});
	});

	test("chat matches baseline", async ({ page }) => {
		await page.goto("/chat");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("core--chat.png", {
			fullPage: true,
		});
	});

	test("crm matches baseline", async ({ page }) => {
		await page.goto("/crm");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("core--crm.png", {
			fullPage: true,
		});
	});

	test("org dashboard matches baseline", async ({ page }) => {
		// /organizations/acme redirects to /organizations/acme/dashboard
		await page.goto("/organizations/acme");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("org--dashboard.png", {
			fullPage: true,
		});
	});

	test("org settings general matches baseline", async ({ page }) => {
		await page.goto("/organizations/acme/settings/general");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("org--general.png", {
			fullPage: true,
		});
	});

	test("org settings members matches baseline", async ({ page }) => {
		await page.goto("/organizations/acme/settings/members");
		await page.waitForLoadState("domcontentloaded");
		// Member list loads client-side — wait for a seeded member row.
		await expect(
			page.getByText(/admin@fuutu\.local|member@fuutu\.local/).first(),
		).toBeVisible({ timeout: 10_000 });
		await expect(page).toHaveScreenshot("org--members.png", {
			fullPage: true,
		});
	});

	test("org invoices matches baseline", async ({ page }) => {
		await page.goto("/organizations/acme/invoices");
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveScreenshot("org--invoices.png", {
			fullPage: true,
		});
	});
});

test.describe("visual regression — overlays", () => {
	test("webhook create dialog matches baseline", async ({ page }) => {
		await page.goto("/organizations/acme/settings/webhooks");
		await page.waitForLoadState("domcontentloaded");
		await page.getByRole("button", { name: /add webhook/i }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveScreenshot("dialog--webhook-create.png");
	});

	test("api-key create dialog matches baseline", async ({ page }) => {
		await page.goto("/settings/api-keys");
		await page.waitForLoadState("domcontentloaded");
		await page.getByRole("button", { name: /create api key/i }).click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await expect(dialog).toHaveScreenshot("dialog--api-key-create.png");
	});

	test("notification bell popover matches baseline", async ({ page }) => {
		await page.goto("/dashboard");
		await page.waitForLoadState("domcontentloaded");
		await page.getByRole("button", { name: /notifications/i }).click();
		const menu = page.getByRole("menu");
		await expect(menu).toBeVisible();
		await expect(menu).toHaveScreenshot("component--notification-bell.png");
	});

	test("org switcher dropdown matches baseline", async ({ page, isMobile }) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");
		await page.waitForLoadState("domcontentloaded");
		await page.getByRole("button", { name: /personal account/i }).click();
		const menu = page.getByRole("menu");
		await expect(menu).toBeVisible();
		await expect(menu).toHaveScreenshot("component--org-switcher.png");
	});

	test("nav user dropdown matches baseline", async ({ page, isMobile }) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");
		await page.waitForLoadState("domcontentloaded");
		const footer = page.locator("[data-sidebar='footer']");
		// Wait for session to load — the button starts as a disabled skeleton
		await expect(footer.getByText(/@/)).toBeVisible({ timeout: 10_000 });
		await footer.getByRole("button").click();
		const menu = page.getByRole("menu");
		await expect(menu).toBeVisible();
		await expect(menu).toHaveScreenshot("component--nav-user.png");
	});
});
