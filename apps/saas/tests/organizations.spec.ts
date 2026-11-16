import { config } from "@fuutu/config";
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

test("the org breadcrumb shows the organization's name, not its slug", async ({
	page,
	baseURL,
}) => {
	const origin = new URL(baseURL ?? page.url()).origin;
	const slug = `e2e-crumb-${Date.now()}`;
	const created = await page.request.post("/api/auth/organization/create", {
		data: { name: "Crumb Labs GmbH", slug },
		headers: { origin },
	});
	expect(created.ok()).toBe(true);
	const { id: orgId } = (await created.json()) as { id: string };
	try {
		await page.goto(`/organizations/${slug}/settings/general`);
		const crumbs = page.getByRole("navigation", { name: /breadcrumb/i });
		await expect(
			crumbs.getByRole("link", { name: "Crumb Labs GmbH" }),
		).toBeVisible({ timeout: 10_000 });
		await expect(crumbs).not.toContainText(/e2e-crumb/i);
	} finally {
		await page.request.post("/api/auth/organization/delete", {
			data: { organizationId: orgId },
			headers: { origin },
		});
	}
});

test.describe("org membership guard", () => {
	test("unknown org slug answers 404 without the app shell", async ({
		page,
	}) => {
		// Regression: organizations/[slug] had no layout guard, so org pages
		// rendered their shell for non-members / nonexistent orgs.
		const response = await page.goto("/organizations/no-such-org/dashboard");
		expect(response?.status()).toBe(404);
		await expect(page.locator("[data-sidebar='sidebar']")).toHaveCount(0);
	});

	test("another org's pages answer 404 to a non-member and never name it", async ({
		page,
		browser,
		baseURL,
	}) => {
		const origin = new URL(baseURL ?? page.url()).origin;
		const slug = `e2e-private-${Date.now()}`;
		const name = `Private Org ${Date.now()}`;
		// Created by the seeded admin — the seeded member is not in it.
		const created = await page.request.post("/api/auth/organization/create", {
			data: { name, slug },
			headers: { origin },
		});
		expect(created.ok()).toBe(true);
		const { id: orgId } = (await created.json()) as { id: string };

		const memberContext = await browser.newContext({
			storageState: { cookies: [], origins: [] },
		});
		try {
			const member = await memberContext.newPage();
			await member.goto("/auth/sign-in");
			await member.getByLabel("Email").fill("member@fuutu.local");
			await member.getByLabel("Password").fill("DevPassword!2345");
			await member
				.getByRole("button", { name: "Sign in", exact: true })
				.click();
			await member.waitForURL(/\/dashboard|\/onboarding/, {
				timeout: 30_000,
			});

			for (const path of ["dashboard", "settings/billing"]) {
				const response = await member.goto(`/organizations/${slug}/${path}`);
				expect(response?.status(), path).toBe(404);
				await expect(member.locator("[data-sidebar='sidebar']")).toHaveCount(0);
				await expect(member.getByText(/something went wrong/i)).toHaveCount(0);
				expect(await member.content()).not.toContain(name);
			}
		} finally {
			await memberContext.close();
			await page.request.post("/api/auth/organization/delete", {
				data: { organizationId: orgId },
				headers: { origin },
			});
		}
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

// Anyone can sign up with an invited address. Until that address is
// verified, the invitation is neither listed nor accepted — the pages ask
// to verify the email instead.
test.describe("invitations need a verified email", () => {
	test("an unverified sign-up with the invited address cannot see or accept it; once verified it can", async ({
		browser,
		baseURL,
		request,
	}) => {
		test.skip(
			config.features.organizationsMode === "off",
			"organizations are off — no invitations",
		);
		// Better Auth refuses cookie-authenticated POSTs without an Origin.
		const headers = { origin: new URL(baseURL ?? "").origin };
		const email = `qa-unverified-${Date.now()}@fuutu.local`;
		const password = "InviteePassword!2345";
		const org = (await (
			await request.get(
				"/api/auth/organization/get-full-organization?organizationSlug=acme",
			)
		).json()) as { id: string };
		const invited = await request.post("/api/auth/organization/invite-member", {
			data: { email, role: "admin", organizationId: org.id },
			headers,
		});
		expect(invited.ok(), await invited.text()).toBe(true);
		const invitation = (await invited.json()) as { id: string };

		const context = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] },
		});
		await context.addCookies([
			{ name: "fuutu.consent.v1", value: "granted", url: baseURL },
		]);
		let userId: string | undefined;
		try {
			const signUp = await context.request.post("/api/auth/sign-up/email", {
				data: { email, password, name: "Unverified Invitee" },
				headers,
			});
			expect(signUp.ok()).toBe(true);
			userId = ((await signUp.json()) as { user: { id: string } }).user.id;

			// Better Auth refuses the accept itself, not only the UI.
			const accept = await context.request.post(
				"/api/auth/organization/accept-invitation",
				{ data: { invitationId: invitation.id }, headers },
			);
			expect(accept.status()).toBe(403);

			const page = await context.newPage();
			await page.goto(`/auth/accept-invitation?id=${invitation.id}`);
			await expect(page.getByText("Verify your email first")).toBeVisible({
				timeout: 10_000,
			});
			await expect(
				page.getByRole("button", { name: "Send verification email" }),
			).toBeVisible();
			await expect(
				page.getByRole("button", { name: "Accept invitation" }),
			).toHaveCount(0);

			// A new user lands in onboarding; its org step lists invitations.
			await page.goto("/onboarding");
			await expect(page.getByLabel(/full name/i)).toBeVisible({
				timeout: 10_000,
			});
			await page.getByRole("button", { name: /continue/i }).click();
			await expect(page.getByText("Verify your email first")).toBeVisible({
				timeout: 10_000,
			});
			await expect(
				page.getByRole("link", { name: /accept invitation/i }),
			).toHaveCount(0);

			// Verified (here by a system admin), the invitation opens up —
			// a fresh sign-in carries the verified flag in the session.
			const verified = await request.patch(`/api/admin/users/${userId}`, {
				data: { emailVerified: true },
				headers,
			});
			expect(verified.ok()).toBe(true);
			await context.clearCookies();
			await context.addCookies([
				{ name: "fuutu.consent.v1", value: "granted", url: baseURL },
			]);
			const signIn = await context.request.post("/api/auth/sign-in/email", {
				data: { email, password },
				headers,
			});
			expect(signIn.ok()).toBe(true);

			// The reload resumes at the org step.
			await page.goto("/onboarding");
			await expect(
				page.getByRole("link", { name: /acme.*accept invitation/i }),
			).toBeVisible({ timeout: 10_000 });
			await expect(page.getByText("Verify your email first")).toHaveCount(0);

			await page.goto(`/auth/accept-invitation?id=${invitation.id}`);
			await page.getByRole("button", { name: "Accept invitation" }).click();
			await expect(page).not.toHaveURL(/\/auth\/accept-invitation/, {
				timeout: 15_000,
			});
			const orgs = (await (
				await context.request.get("/api/auth/organization/list")
			).json()) as { slug: string }[];
			expect(orgs.map((o) => o.slug)).toContain("acme");
		} finally {
			await context.close();
			await request.post("/api/auth/organization/cancel-invitation", {
				data: { invitationId: invitation.id },
				headers,
			});
			if (userId) {
				await request.post("/api/auth/organization/remove-member", {
					data: { memberIdOrEmail: email, organizationId: org.id },
					headers,
				});
				await request.delete(`/api/admin/users/${userId}`, {
					data: { reason: "E2E cleanup", confirmEmail: email },
					headers,
				});
			}
		}
	});
});
