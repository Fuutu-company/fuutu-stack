import { expect, test } from "./fixtures";

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
			.getByRole("button", { name: /settings/i })
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

		// Role select is labeled "Role" via aria-label
		await expect(page.getByRole("combobox", { name: /role/i })).toBeVisible({
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

		// "Cancel invite" button appears next to the pending invitation
		const cancelButton = page
			.getByRole("button", { name: /cancel invite/i })
			.first();
		await expect(cancelButton).toBeVisible({ timeout: 10_000 });
		await cancelButton.click();
		await expect(page.getByText(inviteEmail)).not.toBeVisible({
			timeout: 10_000,
		});
	});
});
