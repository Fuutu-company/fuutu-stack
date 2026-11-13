import { expect, test } from "./fixtures";

/**
 * The breadcrumb in the app header names the page, so app pages carry no
 * big title: one visually hidden h1 (screen readers, document outline)
 * and, where the page has them, its actions in a compact row. The
 * dashboard greeting and the /design intro keep a visible h1.
 */
const COMPACT_ROUTES = [
	"/chat",
	"/organizations/acme/chat",
	"/organizations/acme/crm",
	"/notifications",
	"/settings?tab=profile",
	"/settings?tab=security",
	"/settings?tab=sessions",
	"/settings?tab=credits",
	"/settings?tab=danger",
	"/settings/api-keys",
	"/settings/credits",
	"/settings/billing",
	"/organizations",
	"/organizations/acme/settings/general",
	"/organizations/acme/settings/members",
	"/organizations/acme/settings/billing",
	"/organizations/acme/settings/credits",
	"/organizations/acme/settings/api-keys",
	"/organizations/acme/settings/webhooks",
	"/organizations/acme/settings/audit-log",
	"/organizations/acme/settings/danger",
	"/organizations/acme/invoices",
	"/admin/users",
	"/admin/audit-logs",
	"/choose-plan",
];

const VISIBLE_ROUTES = ["/dashboard", "/design"];

/** sr-only collapses the box to 1×1 and clips it. */
const isVisuallyHidden = (el: Element) => {
	const box = el.getBoundingClientRect();
	return box.width <= 1 && box.height <= 1;
};

test.describe("page titles", () => {
	for (const route of COMPACT_ROUTES) {
		test(`${route} has exactly one h1, visually hidden`, async ({ page }) => {
			await page.goto(route);
			const h1 = page.getByRole("main").getByRole("heading", { level: 1 });
			await expect(h1).toHaveCount(1, { timeout: 10_000 });
			await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
			await expect(h1).not.toHaveText("");
			expect(await h1.evaluate(isVisuallyHidden)).toBe(true);
			await expect(page.locator("[data-slot='page-header']")).toHaveCount(1);
			await expect(
				page.locator("[data-slot='page-header'][data-variant='compact']"),
			).toHaveCount(1);
		});
	}

	for (const route of VISIBLE_ROUTES) {
		test(`${route} keeps one visible h1`, async ({ page }) => {
			await page.goto(route);
			const h1 = page.getByRole("main").getByRole("heading", { level: 1 });
			await expect(h1).toHaveCount(1, { timeout: 10_000 });
			await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
			expect(await h1.evaluate(isVisuallyHidden)).toBe(false);
		});
	}

	test("CRM keeps its New contact action in the compact row", async ({
		page,
	}) => {
		await page.goto("/organizations/acme/crm");
		const header = page.locator(
			"[data-slot='page-header'][data-variant='compact']",
		);
		await expect(
			header
				.locator("[data-slot='page-header-actions']")
				.getByRole("button", { name: /new contact/i }),
		).toBeVisible({ timeout: 10_000 });
		// Right-aligned: the action ends at the content column's right edge.
		const [actionsRight, columnRight] = await header.evaluate((el) => {
			const actions = el.querySelector("[data-slot='page-header-actions']");
			return [
				actions?.getBoundingClientRect().right ?? 0,
				el.getBoundingClientRect().right,
			];
		});
		expect(Math.abs(columnRight - actionsRight)).toBeLessThanOrEqual(1);
	});
});
