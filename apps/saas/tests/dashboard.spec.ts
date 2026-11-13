import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const AREAS = ["users", "billing", "ai", "api"] as const;

for (const mode of [
	{ name: "personal mode", path: "/dashboard", org: false },
	{ name: "org mode", path: "/organizations/acme/dashboard", org: true },
]) {
	test.describe(`dashboard page — ${mode.name}`, () => {
		test("loads without auth redirect and greets the user", async ({
			page,
		}) => {
			await page.goto(mode.path);
			expect(page.url()).not.toMatch(/\/auth\/sign-in/);
			await expect(
				page.getByRole("heading", { level: 1, name: /welcome back,/i }),
			).toBeVisible({ timeout: 10_000 });
		});

		test("shows four area tiles (users, billing, ai, api) with non-empty values", async ({
			page,
		}) => {
			await page.goto(mode.path);

			for (const area of AREAS) {
				const tile = page.locator(
					`[data-slot="area-tile"][data-area="${area}"]`,
				);
				await expect(tile).toBeVisible({ timeout: 10_000 });
				const text = (await tile.innerText()).trim();
				expect(text.length).toBeGreaterThan(0);
				// A real value, not a placeholder dash or loading skeleton.
				expect(text).toMatch(/\d|[A-Za-z]{3,}/);
			}
			await expect(page.locator('[data-slot="area-tile"]')).toHaveCount(4);
		});

		for (const locale of ["en", "de"] as const) {
			for (const width of [1280, 375]) {
				test(`tile values share one baseline (${locale}, ${width}px)`, async ({
					page,
					context,
					baseURL,
				}) => {
					await context.addCookies([
						{ name: "NEXT_LOCALE", value: locale, url: baseURL },
					]);
					await page.setViewportSize({ width, height: 900 });
					await page.goto(mode.path);
					const values = page.locator('[data-slot="area-tile-value"]');
					await expect(values).toHaveCount(4, { timeout: 10_000 });

					const tiles = await page
						.locator('[data-slot="area-tile"]')
						.evaluateAll((els) =>
							els.map((tile) => {
								const box = tile.getBoundingClientRect();
								const value = tile.querySelector(
									'[data-slot="area-tile-value"]',
								);
								const caption = tile.querySelector(
									'[data-slot="area-tile-caption"]',
								);
								return {
									top: Math.round(box.top),
									// Value baseline as an offset from the tile's bottom edge.
									valueOffset: Math.round(
										box.bottom - (value?.getBoundingClientRect().bottom ?? 0),
									),
									captionHeight: caption?.getBoundingClientRect().height ?? 0,
									captionLineHeight: caption
										? Number.parseFloat(getComputedStyle(caption).lineHeight)
										: 0,
								};
							}),
						);
					// Same offset in every tile, so tiles in one row line up.
					expect(new Set(tiles.map((t) => t.valueOffset)).size).toBe(1);
					// Captions never wrap; long copy is clamped to one line.
					for (const tile of tiles) {
						expect(tile.captionHeight).toBeLessThanOrEqual(
							tile.captionLineHeight + 1,
						);
					}
					if (width === 1280) {
						expect(new Set(tiles.map((t) => t.top)).size).toBe(1);
					}

					// Structure, not copy: an overlong caption must not lift its value.
					const offsets = await page
						.locator('[data-slot="area-tile"]')
						.evaluateAll((els) => {
							const caption = els[0]?.querySelector(
								'[data-slot="area-tile-caption"]',
							);
							if (caption) caption.textContent = "word ".repeat(40);
							return els.map((tile) =>
								Math.round(
									tile.getBoundingClientRect().bottom -
										(tile
											.querySelector('[data-slot="area-tile-value"]')
											?.getBoundingClientRect().bottom ?? 0),
								),
							);
						});
					expect(new Set(offsets).size).toBe(1);
				});
			}
		}

		test("a clamped tile caption keeps its full text in a title", async ({
			page,
		}) => {
			await page.setViewportSize({ width: 1280, height: 900 });
			await page.goto(mode.path);
			const captions = page.locator('[data-slot="area-tile-caption"]');
			await expect(captions).toHaveCount(4, { timeout: 10_000 });
			for (const caption of await captions.all()) {
				await expect(caption).toHaveAttribute("title", /\S/);
				expect(await caption.getAttribute("title")).toBe(
					(await caption.textContent())?.trim(),
				);
			}
		});

		test("area tiles link to their area pages", async ({ page }) => {
			await page.goto(mode.path);
			const expected = mode.org
				? {
						users: "/organizations/acme/settings/members",
						billing: "/organizations/acme/settings/billing",
						ai: "/organizations/acme/settings/credits",
						api: "/organizations/acme/settings/api-keys",
					}
				: {
						users: "/organizations",
						billing: "/organizations",
						ai: "/settings?tab=credits",
						api: "/settings/api-keys",
					};
			for (const area of AREAS) {
				const link = page.getByRole("link").filter({
					has: page.locator(`[data-slot="area-tile"][data-area="${area}"]`),
				});
				await expect(link).toHaveAttribute("href", expected[area], {
					timeout: 10_000,
				});
				await expect(link).toHaveAccessibleName(/\w{3,}/);
			}
			await page
				.getByRole("link", { name: /^api keys/i })
				.first()
				.click();
			await expect(page).toHaveURL(/\/settings\/api-keys/);
		});

		test("Happening now lists at least one item", async ({ page }) => {
			await page.goto(mode.path);

			const feed = page.getByTestId("happening-now");
			await expect(feed).toBeVisible({ timeout: 10_000 });
			await expect(feed.getByRole("heading")).toHaveText(/happening now/i);
			await expect(feed.getByRole("listitem").first()).toBeVisible({
				timeout: 10_000,
			});
			expect(await feed.getByRole("listitem").count()).toBeGreaterThanOrEqual(
				1,
			);
		});

		test("activity chart has an accessible summary", async ({ page }) => {
			await page.goto(mode.path);

			const chart = page.getByTestId("activity-chart");
			await expect(chart).toBeVisible({ timeout: 10_000 });
			const summary = chart.locator("figcaption");
			await expect(summary).toHaveText(
				/\d[\d,.]* events in 30 days, busiest day/i,
			);
			await expect(chart.getByRole("img")).toHaveAccessibleName(
				/events in 30 days/i,
			);
			await expect(chart).toHaveAttribute("data-volatile", "");
		});

		test("plan usage lists members or organizations and API keys", async ({
			page,
		}) => {
			await page.goto(mode.path);

			const usage = page.getByTestId("plan-usage");
			await expect(usage).toBeVisible({ timeout: 10_000 });
			await expect(
				usage.getByText(mode.org ? /^members$/i : /^organizations$/i),
			).toBeVisible();
			await expect(usage.getByText(/^api keys$/i)).toBeVisible();
			if (mode.org) {
				await expect(usage.getByText(/^webhooks$/i)).toBeVisible();
			}
		});

		test("Make it yours links to /design", async ({ page }) => {
			await page.goto(mode.path);

			const card = page.getByTestId("make-it-yours");
			await expect(card).toBeVisible({ timeout: 10_000 });
			await expect(card).toContainText("brand.css");
			await expect(
				card.getByRole("link", { name: /open design system/i }),
			).toHaveAttribute("href", "/design");
			await expect(
				card.getByRole("link", { name: /theming guide/i }),
			).toHaveAttribute("href", /\/docs\/guides\/theming/);
		});
	});
}

test.describe("dashboard page — overview load failure", () => {
	/**
	 * Fails `dashboard.overview` until `recover()` is called, then lets the
	 * real requests through. Counts every overview request.
	 */
	async function failOverview(page: Page) {
		const state = { failing: true, requests: 0 };
		await page.route("**/api/rpc/dashboard/overview", async (route) => {
			state.requests += 1;
			if (!state.failing) return route.continue();
			return route.fulfill({
				status: 500,
				contentType: "application/json",
				body: JSON.stringify({
					json: {
						defined: false,
						code: "INTERNAL_SERVER_ERROR",
						status: 500,
						message: "Internal server error",
					},
				}),
			});
		});
		return {
			state,
			recover: () => {
				state.failing = false;
			},
		};
	}

	for (const mode of [
		{ name: "personal", path: "/dashboard" },
		{ name: "org", path: "/organizations/acme/dashboard" },
	]) {
		test(`${mode.name}: the error card's Try again reloads the overview`, async ({
			page,
		}) => {
			test.setTimeout(60_000);
			const pageErrors: Error[] = [];
			page.on("pageerror", (err) => pageErrors.push(err));
			const { recover } = await failOverview(page);
			await page.goto(mode.path);

			// TanStack Query retries 3× with backoff before the error state shows.
			const error = page.getByTestId("dashboard-load-error");
			await expect(error).toBeVisible({ timeout: 30_000 });
			await expect(error).toHaveAttribute("role", "alert");
			await expect(error.getByRole("heading", { level: 2 })).toBeVisible();

			recover();
			await error.getByRole("button", { name: /try again/i }).click();
			await expect(page.locator('[data-slot="area-tile"]')).toHaveCount(4, {
				timeout: 15_000,
			});
			await expect(error).toBeHidden();
			expect(pageErrors).toEqual([]);
		});
	}

	test("the error toast's Retry refetches the failed query without a page error", async ({
		page,
	}) => {
		test.setTimeout(60_000);
		const pageErrors: Error[] = [];
		page.on("pageerror", (err) => pageErrors.push(err));
		const { state, recover } = await failOverview(page);
		await page.goto("/dashboard");

		const retry = page
			.locator("[data-sonner-toast]")
			.getByRole("button", { name: "Retry", exact: true });
		await expect(retry).toBeVisible({ timeout: 30_000 });
		const before = state.requests;

		recover();
		await retry.click();
		await expect(page.locator('[data-slot="area-tile"]')).toHaveCount(4, {
			timeout: 15_000,
		});
		expect(state.requests).toBeGreaterThan(before);
		expect(pageErrors).toEqual([]);
	});
});

test.describe("dashboard page — header actions", () => {
	test("personal dashboard offers View organizations", async ({ page }) => {
		await page.goto("/dashboard");
		await expect(
			page.getByRole("link", { name: /view organizations/i }),
		).toHaveAttribute("href", "/organizations", { timeout: 10_000 });
	});

	test("org dashboard offers Invite member for admins", async ({ page }) => {
		await page.goto("/organizations/acme/dashboard");
		await expect(
			page.getByRole("link", { name: /invite member/i }),
		).toHaveAttribute("href", "/organizations/acme/settings/members", {
			timeout: 10_000,
		});
	});
});
