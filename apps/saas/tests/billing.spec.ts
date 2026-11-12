import { expect, test } from "./fixtures";

test.describe("billing & checkout flows", () => {
	test("choose-plan page renders", async ({ page }) => {
		await page.goto("/choose-plan");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});

	test("can navigate from sidebar to choose-plan", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");

		await page
			.getByRole("link", { name: /billing/i })
			.first()
			.click();
		await expect(page).toHaveURL(/\/choose-plan/);
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
		await page
			.getByRole("button", { name: /upgrade to pro/i })
			.first()
			.click();

		await expect.poll(() => checkoutInput).toBeTruthy();
		expect(checkoutInput).toMatchObject({
			planId: "pro",
			organizationId: activeOrgId,
		});
	});

	test("settings page renders for authenticated user", async ({ page }) => {
		await page.goto("/settings");
		expect(page.url()).not.toMatch(/\/auth\/sign-in/);
	});
});
