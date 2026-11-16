import { config } from "@fuutu/config";
import { expect, test } from "./fixtures";

const SEEDED_ADMIN_NAME = "Admin User";
/** The seeded admin belongs to Acme — what that means for the org step depends on the mode. */
const ORGS_MODE = config.features.organizationsMode;
/** Progress badge of step `n` ("Step 2 of 3"). */
const stepBadge = (n: number) => new RegExp(`^step ${n} of \\d+$`, "i");

test.describe("onboarding flow", () => {
	test.afterEach(async ({ request }) => {
		await request.post("/api/auth/update-user", {
			data: { name: SEEDED_ADMIN_NAME },
		});
	});

	test("onboarding page is accessible for authenticated user", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);
	});

	test("onboarding page renders with welcome heading", async ({ page }) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		await expect(
			page.getByRole("heading", { name: /welcome to fuutu/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("onboarding has profile setup form with name input and continue button", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		// Profile step: full name input labeled "Full name"
		await expect(page.getByLabel(/full name/i)).toBeVisible({
			timeout: 10_000,
		});

		// Continue button to proceed to org step
		await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
	});

	test("onboarding profile step transitions to org step on continue", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		// Fill in the name field
		const nameInput = page.getByLabel(/full name/i);
		await expect(nameInput).toBeVisible({ timeout: 10_000 });
		await nameInput.fill("Test Onboarding User");

		// Click continue — calls authClient.updateUser, then advances to org step
		await page.getByRole("button", { name: /continue/i }).click();

		// Org step renders "Skip for now" and "Create organization" buttons
		await expect(
			page.getByRole("button", { name: /skip for now/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("button", { name: /create organization/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("onboarding org step can be skipped to reach done step", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		await expect(page).not.toHaveURL(/\/auth\/sign-in/);

		// Profile step — fill name and continue
		const nameInput = page.getByLabel(/full name/i);
		await expect(nameInput).toBeVisible({ timeout: 10_000 });
		await nameInput.fill("Test Onboarding User");
		await page.getByRole("button", { name: /continue/i }).click();

		// Org step — skip
		await expect(
			page.getByRole("button", { name: /skip for now/i }),
		).toBeVisible({ timeout: 10_000 });
		await page.getByRole("button", { name: /skip for now/i }).click();

		// Done step — "Go to dashboard" button appears
		await expect(
			page.getByRole("button", { name: /go to dashboard/i }),
		).toBeVisible({ timeout: 10_000 });
	});

	test("a reload resumes at the step reached instead of restarting", async ({
		page,
	}) => {
		await page.goto("/onboarding");
		const nameInput = page.getByLabel(/full name/i);
		await expect(nameInput).toBeVisible({ timeout: 10_000 });
		await nameInput.fill("Test Onboarding User");
		await page.getByRole("button", { name: /continue/i }).click();
		// Step 2 is the org step or, without one, the next app/kit step.
		const secondStep = page.getByText(stepBadge(2));
		await expect(secondStep).toBeVisible({ timeout: 10_000 });

		await page.reload();
		await expect(secondStep).toBeVisible({ timeout: 10_000 });
		await expect(page.getByLabel(/full name/i)).toBeHidden();
	});

	test("forced mode: a member of an organization starts at the profile step and gets no org step", async ({
		page,
	}) => {
		test.skip(ORGS_MODE !== "forced", 'organizationsMode is not "forced"');
		await page.goto("/onboarding");
		const nameInput = page.getByLabel(/full name/i);
		await expect(nameInput).toBeVisible({ timeout: 10_000 });
		await expect(page.getByText(stepBadge(1))).toBeVisible();
		await nameInput.fill("Test Onboarding User");
		await page.getByRole("button", { name: /continue/i }).click();

		await expect(page.getByText(stepBadge(2))).toBeVisible({
			timeout: 10_000,
		});
		await expect(page.getByLabel(/organization name/i)).toBeHidden();
		await expect(
			page.getByRole("button", { name: /create organization/i }),
		).toBeHidden();
	});

	test("an organization created in the flow is not offered again after a reload", async ({
		page,
	}) => {
		test.skip(
			ORGS_MODE !== "on",
			'Only organizationsMode "on" offers the org step to an org member',
		);
		// The create call answers like the API (seeded plans may cap orgs).
		await page.route("**/api/rpc/organizations/create", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					json: { id: "org-e2e", name: "Onboarding Org", slug: "onb-org" },
				}),
			}),
		);
		await page.goto("/onboarding");
		const nameInput = page.getByLabel(/full name/i);
		await expect(nameInput).toBeVisible({ timeout: 10_000 });
		await nameInput.fill("Test Onboarding User");
		await page.getByRole("button", { name: /continue/i }).click();
		await page.getByLabel(/organization name/i).fill("Onboarding Org");
		await page.getByRole("button", { name: /create organization/i }).click();
		const goToDashboard = page.getByRole("button", {
			name: /go to dashboard/i,
		});
		await expect(goToDashboard).toBeVisible({ timeout: 10_000 });

		await page.reload();
		await expect(goToDashboard).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByRole("button", { name: /create organization/i }),
		).toBeHidden();
	});

	test("an impersonation started after the page loaded gets the support message", async ({
		page,
	}) => {
		// Another tab started impersonating: the guard refuses the update.
		await page.route("**/api/auth/update-user", (route) =>
			route.fulfill({
				status: 403,
				contentType: "application/json",
				body: JSON.stringify({
					code: "IMPERSONATION_FORBIDDEN",
					message: "Not allowed while impersonating a user",
				}),
			}),
		);
		await page.goto("/onboarding");
		const nameInput = page.getByLabel(/full name/i);
		await expect(nameInput).toBeVisible({ timeout: 10_000 });
		await nameInput.fill("Test Onboarding User");
		await page.getByRole("button", { name: /continue/i }).click();

		await expect(
			page.getByText(/can't change this user's name while impersonating/i),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			page.getByText(/could not save onboarding step/i),
		).toBeHidden();
	});
});
