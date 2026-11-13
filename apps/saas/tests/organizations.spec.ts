import { expect, test } from "./fixtures";
import { orgSettingsCopy } from "./kit-catalog";

test.describe("organization flows", () => {
	test("organizations page renders for authenticated user", async ({
		page,
	}) => {
		await page.goto("/organizations");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});

	test("seeded acme org is visible on organizations page", async ({ page }) => {
		await page.goto("/organizations");
		await expect(page.getByText(/acme/i).first()).toBeVisible({
			timeout: 10_000,
		});
	});

	test("acme org settings page renders with members", async ({ page }) => {
		await page.goto("/organizations/acme/settings/members");

		await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
			timeout: 10_000,
		});

		await expect(
			page.getByText(/admin@fuutu.local|member@fuutu.local/).first(),
		).toBeVisible();
	});

	test("can navigate from sidebar to organizations", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		// Organization group only appears in org context
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
});

test.describe("organization settings — invite & members", () => {
	test("org settings page has invite form with email input and invite button", async ({
		page,
	}) => {
		await page.goto("/organizations/acme/settings/members");

		await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
			timeout: 10_000,
		});

		// Invite form: email input + invite submit button
		await expect(page.getByPlaceholder(/teammate@company\.com/i)).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByRole("button", { name: /^invite$/i })).toBeVisible();
	});

	test("invite form includes role selector", async ({ page }) => {
		await page.goto("/organizations/acme/settings/members");

		await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
			timeout: 10_000,
		});

		// Invite role select is labeled exactly "Role" — per-member role
		// selects are labeled "Change role for …".
		await expect(page.getByRole("combobox", { name: /^role$/i })).toBeVisible({
			timeout: 10_000,
		});
	});

	test("members list is visible on org settings page", async ({ page }) => {
		await page.goto("/organizations/acme/settings/members");

		await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
			timeout: 10_000,
		});

		// Seeded members (admin@fuutu.local, member@fuutu.local) should appear
		await expect(
			page.getByText(/admin@fuutu\.local|member@fuutu\.local/).first(),
		).toBeVisible({ timeout: 10_000 });
	});

	test("inviting a teammate adds them to pending invitations", async ({
		page,
	}) => {
		const inviteEmail = `qa-invite-${Date.now()}@fuutu.local`;

		await page.goto("/organizations/acme/settings/members");

		await expect(page.getByRole("heading", { name: /members/i })).toBeVisible({
			timeout: 10_000,
		});

		// Fill invite form and submit
		const emailInput = page.getByPlaceholder(/teammate@company\.com/i);
		await expect(emailInput).toBeVisible({ timeout: 10_000 });
		await emailInput.fill(inviteEmail);

		const inviteButton = page.getByRole("button", { name: /^invite$/i });
		await inviteButton.click();

		// The invited email appears in the pending invitations section
		await expect(page.getByText(inviteEmail)).toBeVisible({
			timeout: 10_000,
		});

		// "Cancel invite" on THIS invitation's row — other pending invites
		// (from earlier runs) may be listed above it.
		const cancelButton = page
			.getByRole("listitem")
			.filter({ hasText: inviteEmail })
			.getByRole("button", { name: /cancel invite/i });
		await expect(cancelButton).toBeVisible({ timeout: 10_000 });
		await cancelButton.click();
		await expect(page.getByText(inviteEmail)).not.toBeVisible({
			timeout: 10_000,
		});
	});

	test("an owner can change a member's role and change it back", async ({
		page,
	}) => {
		await page.goto("/organizations/acme/settings/members");
		// Scoped to <main>: the sidebar's user menu is a listitem too.
		const memberRow = page
			.getByRole("main")
			.getByRole("listitem")
			.filter({ hasText: "member@fuutu.local" });
		const roleSelect = memberRow.getByRole("combobox", {
			name: /change role for member user/i,
		});
		await expect(roleSelect).toBeVisible({ timeout: 10_000 });

		await roleSelect.click();
		await page.getByRole("option", { name: /^admin$/i }).click();
		await expect(page.getByText(/role updated/i).first()).toBeVisible({
			timeout: 10_000,
		});
		await expect(memberRow).toContainText(/· admin/i);

		await roleSelect.click();
		await page.getByRole("option", { name: /^member$/i }).click();
		await expect(memberRow).toContainText(/· member/i, { timeout: 10_000 });
	});

	test("the owner's own row has no role select", async ({ page }) => {
		await page.goto("/organizations/acme/settings/members");
		const ownRow = page
			.getByRole("main")
			.getByRole("listitem")
			.filter({ hasText: "admin@fuutu.local" });
		await expect(ownRow).toBeVisible({ timeout: 10_000 });
		await expect(ownRow.getByRole("combobox")).toHaveCount(0);
	});

	test("a seat-limit rejection shows the seat cap and the upgrade link", async ({
		page,
	}) => {
		// Replay the server's typed PAYMENT_REQUIRED error (wire shape pinned
		// by packages/api seat-limit-wire.test.ts) — the UI must not
		// pre-count seats, it reacts to the server's answer.
		await page.route("**/api/rpc/organizations/members/invite", (route) =>
			route.fulfill({
				status: 402,
				contentType: "application/json",
				body: JSON.stringify({
					json: {
						defined: false,
						code: "PAYMENT_REQUIRED",
						status: 402,
						message: "Organization seat limit reached",
						data: {
							seatsTotal: 3,
							upgradeUrl: "/organizations/acme/settings/billing",
						},
					},
				}),
			}),
		);

		await page.goto("/organizations/acme/settings/members");
		const emailInput = page.getByPlaceholder(/teammate@company\.com/i);
		await expect(emailInput).toBeVisible({ timeout: 10_000 });
		await emailInput.fill(`qa-seat-${Date.now()}@fuutu.local`);
		await page.getByRole("button", { name: /^invite$/i }).click();

		await expect(
			page.getByText(orgSettingsCopy("seatLimitReached", { seats: 3 })),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("link", { name: orgSettingsCopy("seatLimitCta") }),
		).toHaveAttribute("href", "/organizations/acme/settings/billing");
	});
});

test.describe("org membership guard", () => {
	test("unknown org slug redirects to /organizations", async ({ page }) => {
		// Regression: organizations/[slug] had no layout guard, so org pages
		// rendered their shell for non-members / nonexistent orgs.
		await page.goto("/organizations/no-such-org/dashboard");
		await expect(page).toHaveURL(/\/organizations$/, { timeout: 10_000 });
	});
});

test.describe("org membership guard (unauthenticated)", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("org dashboard redirects unauthenticated users to sign-in", async ({
		page,
	}) => {
		await page.goto("/organizations/acme/dashboard");
		await expect(page).toHaveURL(/\/auth\/sign-in/);
	});
});
