import { orgsOff } from "./features";
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

	test("user billing lists the organizations the user pays through", async ({
		page,
	}) => {
		// Regression: the tab said "No purchases" for the owner of a paid org.
		// Without organizations the seeded purchase is the admin's own.
		test.skip(...orgsOff());
		await page.goto("/admin/users?q=admin@");
		await page.getByRole("link", { name: /admin@fuutu\.local/ }).click();
		await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);
		await page.getByRole("tab", { name: /^billing/i }).click();

		const acme = page.getByRole("listitem", { name: "Acme" });
		await expect(acme).toBeVisible({ timeout: 10_000 });
		await expect(acme.getByRole("link", { name: "Acme" })).toHaveAttribute(
			"href",
			/\/admin\/organizations\/[^/]+$/,
		);
		// The seeded Acme subscription, with its plan.
		await expect(acme.getByRole("table")).toBeVisible();
		await expect(acme.getByText(/^subscription$/i).first()).toBeVisible();
		await expect(
			page.getByRole("heading", {
				name: /personal subscriptions and purchases/i,
			}),
		).toBeVisible();
	});

	test("impersonation shows the banner and stop returns to the user detail", async ({
		page,
	}) => {
		// A refetch of admin queries with the impersonated cookie would answer
		// 403 before the navigation — nothing may fail on the way.
		const forbidden: string[] = [];
		page.on("response", (response) => {
			if (response.status() === 403) forbidden.push(response.url());
		});
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
		expect(forbidden).toEqual([]);

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

	test("onboarding tells support the name step is closed while impersonating", async ({
		page,
	}) => {
		await page.goto("/admin/users?q=member@");
		await page.getByRole("link", { name: /member@fuutu\.local/ }).click();
		await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);
		await page.getByRole("button", { name: /^actions$/i }).click();
		await page.getByRole("menuitem", { name: /^impersonate/i }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Reason").fill("E2E onboarding check");
		await dialog.getByRole("button", { name: /^impersonate$/i }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		// The name update would answer 403 (IMPERSONATION_FORBIDDEN).
		const updateUser: string[] = [];
		page.on("request", (request) => {
			if (request.url().includes("/api/auth/update-user")) {
				updateUser.push(request.url());
			}
		});
		await page.goto("/onboarding");
		// By role, not text: while React streams the page, a finished
		// Suspense segment waits in a hidden <div id="S:…"> next to the
		// visible copy, and text locators count both (strict-mode flake
		// under load). Role locators see the accessible tree only.
		const nameInput = page.getByRole("textbox", { name: /full name/i });
		await expect(nameInput).toHaveAccessibleDescription(
			/can't change this user's name while impersonating/i,
			{ timeout: 10_000 },
		);
		await expect(nameInput).toBeDisabled();
		await expect(
			page.getByRole("button", { name: /continue/i }),
		).toBeDisabled();
		expect(updateUser).toEqual([]);

		const banner = page.getByRole("status").filter({
			hasText: /you are impersonating/i,
		});
		await banner.getByRole("button", { name: /stop impersonating/i }).click();
		await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/, {
			timeout: 15_000,
		});
	});

	test("billing and API-key creation are closed up front while impersonating", async ({
		page,
	}) => {
		await page.goto("/admin/users?q=member@");
		await page.getByRole("link", { name: /member@fuutu\.local/ }).click();
		await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);
		await page.getByRole("button", { name: /^actions$/i }).click();
		await page.getByRole("menuitem", { name: /^impersonate/i }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Reason").fill("E2E billing check");
		await dialog.getByRole("button", { name: /^impersonate$/i }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

		// The API refuses these (denyImpersonation) — the UI says so before
		// anyone clicks, instead of a generic "Checkout failed".
		const reason = /not available while you're signed in as this user/i;
		// Without organizations the user buys a plan on /choose-plan.
		await page.goto(
			orgsOff()[0] ? "/choose-plan" : "/organizations/acme/settings/billing",
		);
		await expect(page.getByText(reason).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			page.getByRole("button", { name: /upgrade to pro/i }),
		).toBeDisabled();

		await page.goto("/settings/api-keys");
		await expect(page.getByText(reason).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(
			page.getByRole("button", { name: /create api key/i }).first(),
		).toBeDisabled();

		const banner = page.getByRole("status").filter({
			hasText: /you are impersonating/i,
		});
		await banner.getByRole("button", { name: /stop impersonating/i }).click();
		await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/, {
			timeout: 15_000,
		});
	});

	test.describe("without the admin session cookie", () => {
		// Its sign-out ends every session of the browser (multi-session) —
		// an own admin sign-in keeps the shared storage-state session alive.
		test.use({ storageState: { cookies: [], origins: [] } });

		test("stop signs the impersonation out", async ({ page }) => {
			await page.goto("/auth/sign-in");
			await page.getByLabel("Email").fill("admin@fuutu.local");
			await page.getByLabel("Password").fill("DevPassword!2345");
			await page.getByRole("button", { name: "Sign in", exact: true }).click();
			await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30_000 });

			await page.goto("/admin/users?q=member@");
			await page.getByRole("link", { name: /member@fuutu\.local/ }).click();
			await expect(page).toHaveURL(/\/admin\/users\/[^/]+$/);
			await page.getByRole("button", { name: /^actions$/i }).click();
			await page.getByRole("menuitem", { name: /^impersonate/i }).click();
			const dialog = page.getByRole("dialog");
			await dialog
				.getByLabel("Reason")
				.fill("E2E impersonation sign-out check");
			await dialog.getByRole("button", { name: /^impersonate$/i }).click();

			await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
			const banner = page.getByRole("status").filter({
				hasText: /you are impersonating/i,
			});
			await expect(banner).toBeVisible({ timeout: 10_000 });

			// Better Auth can no longer restore the admin: its cookie is gone.
			const adminCookie = (await page.context().cookies()).find((cookie) =>
				cookie.name.endsWith(".admin_session"),
			);
			expect(adminCookie).toBeDefined();
			await page.context().clearCookies({ name: adminCookie?.name });

			await banner.getByRole("button", { name: /stop impersonating/i }).click();
			await expect(page).toHaveURL(/\/auth\/sign-in/, { timeout: 15_000 });
			await page.goto("/dashboard");
			await expect(page).toHaveURL(/\/auth\/sign-in/);
		});
	});

	test("Better Auth admin endpoints are closed to direct HTTP", async ({
		request,
	}) => {
		const res = await request.post("/api/auth/admin/list-users", { data: {} });
		expect(res.status()).toBe(404);
	});
});

test.describe("admin organizations", () => {
	test("lists organizations and searches them via the URL", async ({
		page,
	}) => {
		await page.goto("/admin/organizations");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);
		await expect(
			page.getByRole("columnheader", { name: /organization/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.getByRole("link", { name: /acme/i })).toBeVisible();

		const search = page.getByRole("searchbox", {
			name: /search organizations/i,
		});
		await search.fill("no-such-org-xyz");
		await expect(page).toHaveURL(/q=no-such-org-xyz/);
		await expect(page.getByText("No organizations found.")).toBeVisible({
			timeout: 10_000,
		});

		await search.fill("acm");
		await expect(page).toHaveURL(/q=acm/);
		await expect(page.getByRole("link", { name: /acme/i })).toBeVisible({
			timeout: 10_000,
		});
	});

	test("organization detail renders members, tabs and user links", async ({
		page,
	}) => {
		await page.goto("/admin/organizations?q=acme");
		await page.getByRole("link", { name: /acme/i }).first().click();
		await expect(page).toHaveURL(/\/admin\/organizations\/[^/]+$/);

		await expect(
			page.getByRole("heading", { level: 2, name: /^acme$/i }),
		).toBeVisible({ timeout: 10_000 });
		for (const tab of [
			/^members/i,
			/^invitations/i,
			/^billing/i,
			/^api keys/i,
			/^activity/i,
		]) {
			await expect(page.getByRole("tab", { name: tab })).toBeVisible();
		}
		const memberLink = page.getByRole("link", { name: /member@fuutu\.local/ });
		await expect(memberLink).toBeVisible();
		await expect(memberLink).toHaveAttribute("href", /\/admin\/users\/.+/);
		await expect(page.getByRole("link", { name: /^users$/i })).toHaveCount(1);
	});

	test("admin resends and cancels a pending invitation", async ({ page }) => {
		test.skip(...orgsOff());
		const inviteEmail = `admin-e2e-${Date.now()}@fuutu.local`;

		// A pending invitation through the regular organization flow.
		await page.goto("/organizations/acme/settings/members");
		const emailInput = page.getByPlaceholder(/teammate@company\.com/i);
		await expect(emailInput).toBeVisible({ timeout: 10_000 });
		await emailInput.fill(inviteEmail);
		await page.getByRole("button", { name: /^invite$/i }).click();
		await expect(page.getByText(inviteEmail)).toBeVisible({ timeout: 10_000 });

		await page.goto("/admin/organizations?q=acme");
		await page.getByRole("link", { name: /acme/i }).first().click();
		await page.getByRole("tab", { name: /^invitations/i }).click();
		const row = page.getByRole("row").filter({ hasText: inviteEmail });
		await expect(row).toBeVisible({ timeout: 10_000 });

		await row.getByRole("button", { name: /^resend$/i }).click();
		await expect(page.getByText("Invitation sent again.")).toBeVisible({
			timeout: 10_000,
		});

		await row.getByRole("button", { name: /^cancel$/i }).click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: /^cancel invitation$/i })
			.click();
		await expect(row).toBeHidden({ timeout: 10_000 });
	});
});

test.describe("admin audit logs", () => {
	test("filters by action prefix through the URL and links targets", async ({
		page,
	}) => {
		await page.goto("/admin/audit-logs");
		await expect(page.getByLabel("Action starts with")).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByRole("row").nth(1)).toBeVisible({
			timeout: 10_000,
		});

		await page.getByLabel("Action starts with").fill("org.create");
		await expect(page).toHaveURL(/action=org\.create/);
		await expect(
			page.getByRole("cell", { name: "org.create", exact: true }).first(),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("cell", { name: "auth.session_created" }),
		).toHaveCount(0);
		await expect(
			page.getByRole("link", { name: /^[0-9a-z-]{8}$/ }).first(),
		).toHaveAttribute("href", /\/admin\/(organizations|users)\//);

		await page.getByLabel("Action starts with").fill("no.such.action");
		await expect(page.getByText("No audit logs.")).toBeVisible({
			timeout: 10_000,
		});

		await page.getByRole("button", { name: /clear filters/i }).click();
		await expect(page).not.toHaveURL(/action=/);
	});
});

test.describe("admin system status", () => {
	test("renders database, providers, jobs, flags and versions", async ({
		page,
	}) => {
		await page.goto("/admin/system");
		await expect(page.getByText("Reachable")).toBeVisible({ timeout: 10_000 });
		for (const heading of [
			"Database",
			"Versions",
			"Providers",
			"Scheduled jobs",
			"Feature flags",
		]) {
			await expect(
				page.getByRole("heading", { level: 3, name: heading }),
			).toBeVisible();
		}
		await expect(page.getByText("webhook-retry")).toBeVisible();
		await expect(page.getByText("organizationsMode")).toBeVisible();
	});
});
