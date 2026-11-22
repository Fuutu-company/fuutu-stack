import { paymentsConfig } from "@fuutu/payments/config";
import { orgsOff, paymentsUnconfigured } from "./features";
import { expect, test } from "./fixtures";
import {
	orgSettingsCopy,
	paymentsCopy,
	planCtaLabel,
	upgradePlanId,
} from "./kit-catalog";
import { createThrowawayOrg } from "./throwaway-org";

// The upgrade target and its CTA come from PLANS + translations, not the
// kit demo literals ("pro" / "Upgrade to Pro").
const upgradeCta = planCtaLabel(upgradePlanId);

test.describe("billing & checkout flows", () => {
	test("choose-plan page renders", async ({ page }) => {
		await page.goto("/choose-plan");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});

	test("choose-plan with personal billing calls no organization endpoint", async ({
		page,
	}) => {
		// organizationsMode "off" bills the user and has no organization
		// plugin, so the page must not ask for an active org.
		test.skip(
			paymentsConfig.billingAttachedTo !== "user",
			"billing is attached to organizations",
		);
		// Without the organization client plugin, Better Auth's proxy turns
		// `useActiveOrganization()` into a request to a route that is not
		// there (`/api/auth/use-active-organization`, 404).
		const orgCalls: string[] = [];
		page.on("response", (response) => {
			const url = response.url();
			if (
				url.includes("/api/auth/") &&
				(/organization/i.test(url) || response.status() === 404)
			)
				orgCalls.push(`${response.status()} ${url}`);
		});
		await page.goto("/choose-plan");
		await expect(
			page.locator("[data-slot='pricing-tier']").first(),
		).toBeVisible({ timeout: 10_000 });
		await page.waitForLoadState("networkidle");
		expect(orgCalls).toEqual([]);
	});

	test("without organizations the seeded admin holds the demo Pro subscription", async ({
		request,
	}) => {
		// Billing is per user there, so the seed's demo purchase is the
		// admin's (with organizations it is Acme's).
		test.skip(!orgsOff()[0], "organizations are on (Acme holds it)");
		const res = await request.get("/api/payments/subscription/active");
		expect(res.ok()).toBe(true);
		expect(await res.json()).toMatchObject({
			planId: upgradePlanId,
			status: "ACTIVE",
		});
	});

	for (const width of [1280, 375]) {
		test(`choose-plan: highlighted tier ring and badge are not clipped (${width}px)`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto("/choose-plan");
			const card = page
				.locator("[data-slot='pricing-tier'][data-highlighted]")
				.filter({ visible: true });
			await expect(card).toHaveCount(1, { timeout: 10_000 });
			const cuts = await card.evaluate((el) => {
				const RING = 2;
				const box = el.getBoundingClientRect();
				const found: string[] = [];
				for (let node = el.parentElement; node; node = node.parentElement) {
					const cs = getComputedStyle(node);
					const clipX = cs.overflowX !== "visible";
					const clipY = cs.overflowY !== "visible";
					if (!clipX && !clipY) continue;
					const clip = node.getBoundingClientRect();
					const name = String(node.className);
					if (clipY && box.top - RING < clip.top) found.push(`top: ${name}`);
					if (clipX && box.left - RING < clip.left) found.push(`left: ${name}`);
					if (clipX && box.right + RING > clip.right)
						found.push(`right: ${name}`);
				}
				return found;
			});
			expect(cuts).toEqual([]);
		});
	}

	test("can navigate from the user menu to choose-plan", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");

		const footer = page.locator("[data-sidebar='footer']");
		await expect(footer.getByText(/@/)).toBeVisible({ timeout: 10_000 });
		await footer.getByRole("button").click();
		await page.getByRole("menuitem", { name: /^upgrade/i }).click();

		await expect(page).toHaveURL(/\/choose-plan/);
		await expect(
			page.getByRole("button", { name: upgradeCta }).first(),
		).toBeVisible({ timeout: 10_000 });
	});

	test("can navigate from the sidebar org settings group to org billing", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		test.skip(...orgsOff());
		await page.goto("/organizations/acme/dashboard");

		const settingsGroup = page.locator("[data-nav-group='org-settings']");
		const trigger = settingsGroup.getByRole("button", { name: /^settings$/i });
		await expect(trigger).toHaveAttribute("aria-expanded", "false", {
			timeout: 10_000,
		});
		await trigger.click();
		const billingLink = settingsGroup.getByRole("link", { name: /^billing$/i });
		await billingLink.click();

		await expect(page).toHaveURL(/\/organizations\/acme\/settings\/billing$/);
		await expect(billingLink).toHaveAttribute("aria-current", "page");
		await expect(
			page.getByRole("heading", { level: 1, name: /^billing$/i }),
		).toHaveCount(1);
		await expect(
			page.getByRole("heading", { level: 2, name: /^choose a plan$/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("choose-plan checks out for the active organization in org billing mode", async ({
		page,
		baseURL,
	}) => {
		// Kit default: organizationsMode "on" → billing attached to the org.
		test.skip(...orgsOff());
		const setActive = await page.request.post(
			"/api/auth/organization/set-active",
			{
				data: { organizationSlug: "acme" },
				headers: { origin: new URL(baseURL ?? page.url()).origin },
			},
		);
		expect(setActive.ok()).toBe(true);
		const { id: activeOrgId } = (await setActive.json()) as { id: string };

		let checkoutInput: unknown;
		await page.route("**/api/rpc/payments/checkout/create", async (route) => {
			checkoutInput = (
				route.request().postDataJSON() as { json?: unknown } | null
			)?.json;
			await route.abort();
		});

		await page.goto("/choose-plan");
		await page.getByRole("button", { name: upgradeCta }).first().click();

		await expect.poll(() => checkoutInput).toBeTruthy();
		expect(checkoutInput).toMatchObject({
			planId: upgradePlanId,
			organizationId: activeOrgId,
		});
	});

	test("org billing shows a one-time (lifetime) purchase and hides its Buy", async ({
		page,
		browser,
		baseURL,
	}) => {
		test.skip(...orgsOff());
		test.skip(...paymentsUnconfigured());
		// The kit PLANS ship no one_time plan, so the purchase is the API's
		// answer for one (packages/api billing-lifetime.test.ts pins the
		// mapping from a ONE_TIME purchase row) on an org without a plan.
		// Runs where the payment provider is configured (not in kit CI).
		const slug = `e2e-lifetime-${Date.now()}`;
		const org = await createThrowawayOrg({
			browser,
			baseURL: baseURL ?? new URL(page.url()).origin,
			admin: page.request,
			name: "E2E Lifetime",
			slug,
			joinAsOwner: true,
		});

		try {
			await page.route("**/api/rpc/payments/subscription/lifetime", (route) =>
				route.fulfill({
					contentType: "application/json",
					body: JSON.stringify({
						json: {
							id: "purchase_e2e_lifetime",
							planId: upgradePlanId,
							purchasedAt: "2026-10-03T12:00:00.000Z",
							receipts: true,
						},
					}),
				}),
			);

			await page.goto(`/organizations/${slug}/settings/billing`);

			const plan = paymentsCopy(`plans.${upgradePlanId}.name`);
			await expect(
				page.getByText(paymentsCopy("lifetime.label", { plan })),
			).toBeVisible({ timeout: 10_000 });
			await expect(page.getByText(/Purchased on .*2026/)).toBeVisible();
			// Receipts through the provider portal, not "manage or cancel".
			await expect(
				page.getByRole("button", { name: paymentsCopy("lifetime.receipts") }),
			).toBeVisible();
			// Entitled already: no Buy for that plan, its card is the current one.
			await expect(page.getByRole("button", { name: upgradeCta })).toHaveCount(
				0,
			);
			await expect(
				page
					.getByRole("button", { name: orgSettingsCopy("billingCurrent") })
					.first(),
			).toBeDisabled();
		} finally {
			await org.cleanup();
		}
	});

	test("org billing explains a misconfigured payment provider", async ({
		page,
		browser,
		baseURL,
	}) => {
		test.skip(...orgsOff());
		// Acme is seeded with an active subscription (no upgrade CTA), so use a
		// fresh organization without one.
		const slug = `e2e-billing-${Date.now()}`;
		const org = await createThrowawayOrg({
			browser,
			baseURL: baseURL ?? new URL(page.url()).origin,
			admin: page.request,
			name: "E2E Billing",
			slug,
			joinAsOwner: true,
		});

		try {
			// Replay the API's typed answer for a missing provider key
			// (packages/api payments.test.ts pins the mapping).
			await page.route("**/api/rpc/payments/checkout/create", (route) =>
				route.fulfill({
					status: 503,
					contentType: "application/json",
					body: JSON.stringify({
						json: {
							defined: false,
							code: "SERVICE_UNAVAILABLE",
							status: 503,
							message: "Payments are not configured",
						},
					}),
				}),
			);

			await page.goto(`/organizations/${slug}/settings/billing`);
			await page.getByRole("button", { name: upgradeCta }).first().click();

			await expect(
				page.getByText(/payments are not configured for this environment/i),
			).toBeVisible({ timeout: 10_000 });
		} finally {
			await org.cleanup();
		}
	});

	test("settings page renders for authenticated user", async ({ page }) => {
		await page.goto("/settings");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});
});
