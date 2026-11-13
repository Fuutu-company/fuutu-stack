import { expect, test } from "./fixtures";
import { planCtaLabel, upgradePlanId } from "./kit-catalog";

// The upgrade target and its CTA come from PLANS + translations, not the
// kit demo literals ("pro" / "Upgrade to Pro").
const upgradeCta = planCtaLabel(upgradePlanId);

test.describe("billing & checkout flows", () => {
	test("choose-plan page renders", async ({ page }) => {
		await page.goto("/choose-plan");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
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

	test("org billing explains a misconfigured payment provider", async ({
		page,
		baseURL,
	}) => {
		// Acme is seeded with an active subscription (no upgrade CTA), so use a
		// fresh organization without one.
		const origin = new URL(baseURL ?? page.url()).origin;
		const slug = `e2e-billing-${Date.now()}`;
		const created = await page.request.post("/api/auth/organization/create", {
			data: { name: "E2E Billing", slug },
			headers: { origin },
		});
		expect(created.ok()).toBe(true);
		const { id: orgId } = (await created.json()) as { id: string };

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
			await page.request.post("/api/auth/organization/delete", {
				data: { organizationId: orgId },
				headers: { origin },
			});
		}
	});

	test("settings page renders for authenticated user", async ({ page }) => {
		await page.goto("/settings");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});
});
