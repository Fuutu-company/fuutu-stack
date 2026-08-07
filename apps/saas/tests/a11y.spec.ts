import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

/**
 * Accessibility (a11y) tests using axe-core.
 *
 * Scans key routes for WCAG 2.0 Level A and AA violations.
 * Focuses on critical accessibility issues that impact users.
 *
 * Focus trap status (Q-023):
 * - Dialog: Uses @radix-ui/react-dialog (built-in focus trap)
 * - AlertDialog: Wraps Dialog (inherits focus trap)
 * - Sheet: Uses @radix-ui/react-dialog (built-in focus trap)
 *
 * All modal components have proper focus management via Radix UI primitives.
 * No additional focus-trap dependency needed.
 */

test.describe("accessibility", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("/auth/sign-in has no critical a11y violations", async ({ page }) => {
		await page.goto("/auth/sign-in");
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();
		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("/auth/sign-up has no critical a11y violations", async ({ page }) => {
		await page.goto("/auth/sign-up");
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();
		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("/auth/forgot-password has no critical a11y violations", async ({
		page,
	}) => {
		await page.goto("/auth/forgot-password");
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();
		expect(accessibilityScanResults.violations).toEqual([]);
	});
});

test.describe("authenticated routes accessibility", () => {
	test("/dashboard has no critical a11y violations", async ({ page }) => {
		await page.goto("/dashboard");
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();
		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("/settings has no critical a11y violations", async ({ page }) => {
		await page.goto("/settings");
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();
		expect(accessibilityScanResults.violations).toEqual([]);
	});

	test("/organizations has no critical a11y violations", async ({ page }) => {
		await page.goto("/organizations");
		const accessibilityScanResults = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa"])
			.analyze();
		expect(accessibilityScanResults.violations).toEqual([]);
	});
});
