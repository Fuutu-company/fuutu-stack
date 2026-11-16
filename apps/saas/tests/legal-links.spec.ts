import { config } from "@fuutu/config";
import { expect, test } from "./fixtures";

// § 5 DDG: imprint and privacy reachable from every page — the saas app
// links to the marketing site's legal pages.

test.skip(!config.features.legalPages, "config.features.legalPages is off");

test.describe("legal links", () => {
	test.describe("signed out", () => {
		test.use({ storageState: { cookies: [], origins: [] } });

		test("the auth pages link imprint and privacy on marketing", async ({
			page,
		}) => {
			await page.goto("/auth/sign-in");
			await expect(
				page.getByRole("link", { name: /^imprint$/i }),
			).toHaveAttribute("href", /\/legal\/imprint$/);
			// The sign-in card has its own privacy link; the layout footer is last.
			await expect(
				page.getByRole("link", { name: /^privacy policy$/i }).last(),
			).toHaveAttribute("href", /\/legal\/privacy$/);
		});
	});

	test("the user menu links imprint and privacy on marketing", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");
		const footer = page.locator("[data-sidebar='footer']");
		// The button starts as a disabled skeleton until the session loads.
		await expect(footer.getByText(/@/)).toBeVisible({ timeout: 10_000 });
		await footer.getByRole("button").click();
		const menu = page.getByRole("menu");
		await expect(
			menu.getByRole("menuitem", { name: /^imprint$/i }),
		).toHaveAttribute("href", /\/legal\/imprint$/);
		await expect(
			menu.getByRole("menuitem", { name: /^privacy policy$/i }),
		).toHaveAttribute("href", /\/legal\/privacy$/);
	});
});
