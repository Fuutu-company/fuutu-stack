import { expect, test } from "./fixtures";
import {
	DEFAULT_LOCALE,
	LOCALES,
	localeLabel,
	localePrefix,
	OTHER_LOCALES,
	readHomeMessages,
} from "./locales";

/**
 * Smoke tests for the marketing site.
 * Covers all pages, both locales, nav interactions, and responsive checks.
 * Designed to be stable — assertions check for element presence, not exact text,
 * so downstream kit users don't get false failures after customizing content.
 */

const PAGES = [
	{ path: "", name: "home" },
	{ path: "/pricing", name: "pricing" },
	{ path: "/blog", name: "blog" },
	{ path: "/changelog", name: "changelog" },
	{ path: "/contact", name: "contact" },
	{ path: "/legal/privacy", name: "privacy" },
	{ path: "/legal/terms", name: "terms" },
	{ path: "/legal/imprint", name: "imprint" },
] as const;

// ── Page load: both locales ─────────────────────────────────────────────

test.describe("page loads — all pages, every enabled locale", () => {
	for (const locale of LOCALES) {
		const prefix = localePrefix(locale);

		for (const { path, name } of PAGES) {
			test(`${locale}: /${name} returns 200`, async ({ page }) => {
				const url = `${prefix}${path}`;
				const res = await page.goto(url);
				expect(res?.status()).toBeLessThan(400);
			});
		}
	}
});

// ── Default locale (en) — no prefix ─────────────────────────────────────

test.describe("default locale routing", () => {
	test("/ serves the default locale without prefix", async ({ page }) => {
		const res = await page.goto("/");
		expect(res?.status()).toBeLessThan(400);
		await expect(page).toHaveURL(/\/$/);
	});

	for (const locale of OTHER_LOCALES) {
		test(`/${locale} keeps the locale prefix`, async ({ page }) => {
			const res = await page.goto(`/${locale}`);
			expect(res?.status()).toBeLessThan(400);
			await expect(page).toHaveURL(new RegExp(`/${locale}/?$`));
		});
	}
});

// ── Key content visibility ──────────────────────────────────────────────

test.describe("key content visible", () => {
	for (const locale of LOCALES) {
		test(`/${locale}/pricing renders pricing tiers`, async ({ page }) => {
			await page.goto(`/${locale}/pricing`);
			await expect(
				page.getByRole("heading", { name: /free|pro|enterprise/i }).first(),
			).toBeVisible();
		});
	}

	test(`/${DEFAULT_LOCALE}/blog renders post list or empty state`, async ({
		page,
	}) => {
		await page.goto(`/${DEFAULT_LOCALE}/blog`);
		const headings = page.getByRole("heading", { level: 1 });
		await expect(headings.first()).toBeVisible();
	});

	test(`/${DEFAULT_LOCALE}/changelog renders`, async ({ page }) => {
		await page.goto(`/${DEFAULT_LOCALE}/changelog`);
		await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
	});

	test(`/${DEFAULT_LOCALE}/contact renders contact info`, async ({ page }) => {
		await page.goto(`/${DEFAULT_LOCALE}/contact`);
		await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
		await expect(page.locator("a[href^='mailto:']").first()).toBeVisible();
	});
});

// ── Navigation interactions ─────────────────────────────────────────────

test.describe("navigation", () => {
	test("nav links are present and clickable", async ({ page }) => {
		await page.goto("/");
		const nav = page.locator("nav").first();
		await expect(nav).toBeVisible();
		const links = nav.getByRole("link");
		const count = await links.count();
		expect(count).toBeGreaterThan(0);
	});

	test("footer links are present", async ({ page }) => {
		await page.goto("/");
		const footer = page.locator("footer").first();
		await expect(footer).toBeVisible();
		const links = footer.getByRole("link");
		const count = await links.count();
		expect(count).toBeGreaterThan(0);
	});

	test("clicking nav pricing link navigates to /pricing", async ({ page }) => {
		await page.goto("/");
		const nav = page.locator("nav").first();
		const pricingLink = nav
			.getByRole("link", { name: /pricing|preise/i })
			.first();
		await expect(pricingLink).toBeVisible();
		await pricingLink.click();
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL(/\/pricing/);
	});

	test("locale switcher is hidden when only one locale is enabled", async ({
		page,
	}) => {
		test.skip(OTHER_LOCALES.length > 0, "multiple locales are enabled");
		await page.goto("/");
		await expect(
			page.getByRole("button", { name: /switch language/i }),
		).toHaveCount(0);
	});

	for (const locale of OTHER_LOCALES) {
		test(`locale switcher toggles to ${locale}`, async ({ page }) => {
			await page.goto("/");

			// The locale button has aria-label "Switch language" and shows the current locale
			const localeButton = page
				.getByRole("button", { name: /switch language/i })
				.first();
			await expect(localeButton).toBeVisible();
			await localeButton.click();

			// Dropdown opens with one item per enabled locale — pick it by its label
			const item = page.getByRole("menuitem", {
				name: new RegExp(localeLabel(locale), "i"),
			});
			await expect(item).toBeVisible();
			await item.click();
			await page.waitForLoadState("domcontentloaded");
			await expect(page).toHaveURL(new RegExp(`/${locale}`));
		});
	}

	test("404 page renders for unknown route", async ({ page }) => {
		const res = await page.goto(`/${DEFAULT_LOCALE}/this-page-does-not-exist`);
		expect(res?.status()).toBe(404);
		await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
	});

	test("404 page logs no console errors", async ({ page }) => {
		const errors: string[] = [];
		page.on("console", (msg) => {
			// The browser reports the 404 document itself as a failed resource.
			if (msg.type() === "error" && !msg.text().includes("status of 404")) {
				errors.push(msg.text());
			}
		});
		page.on("pageerror", (err) => errors.push(err.message));

		const res = await page.goto(`/${DEFAULT_LOCALE}/this-page-does-not-exist`);
		expect(res?.status()).toBe(404);
		await page.waitForLoadState("networkidle");
		expect(errors).toEqual([]);
	});
});

// ── Responsive: mobile viewport ─────────────────────────────────────────

test.describe("responsive — mobile viewport", () => {
	test("home page renders on mobile without horizontal scroll", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");
		const scrollWidth = await page.evaluate(
			() => document.documentElement.scrollWidth,
		);
		const clientWidth = await page.evaluate(
			() => document.documentElement.clientWidth,
		);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
	});

	test("pricing page renders on mobile without horizontal scroll", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto(`/${DEFAULT_LOCALE}/pricing`);
		await page.waitForLoadState("domcontentloaded");
		const scrollWidth = await page.evaluate(
			() => document.documentElement.scrollWidth,
		);
		const clientWidth = await page.evaluate(
			() => document.documentElement.clientWidth,
		);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
	});

	test("mobile nav menu toggles", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");
		const nav = page.locator("nav").first();
		await expect(nav).toBeVisible();
	});
});

// ── Responsive: tablet viewport ─────────────────────────────────────────

test.describe("responsive — tablet viewport", () => {
	test("home page renders on tablet without horizontal scroll", async ({
		page,
	}) => {
		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto("/");
		await page.waitForLoadState("domcontentloaded");
		const scrollWidth = await page.evaluate(
			() => document.documentElement.scrollWidth,
		);
		const clientWidth = await page.evaluate(
			() => document.documentElement.clientWidth,
		);
		expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
	});
});

// ── SEO endpoints ───────────────────────────────────────────────────────

test.describe("SEO endpoints", () => {
	test("/sitemap.xml returns XML", async ({ request }) => {
		const res = await request.get("/sitemap.xml");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("xml");
	});

	test("/robots.txt returns text", async ({ request }) => {
		const res = await request.get("/robots.txt");
		expect(res.status()).toBe(200);
	});

	test("/manifest.webmanifest returns JSON", async ({ request }) => {
		const res = await request.get("/manifest.webmanifest");
		expect(res.status()).toBe(200);
		expect(res.headers()["content-type"]).toContain("json");
	});
});

// ── Metadata: generateMetadata works on all pages ───────────────────────

test.describe("page metadata", () => {
	for (const { path, name } of PAGES) {
		test(`${name} page has title and description meta`, async ({ request }) => {
			const res = await request.get(`/${DEFAULT_LOCALE}${path}`);
			expect(res.status()).toBeLessThan(400);
			const html = await res.text();
			expect(html).toMatch(/<title[^>]*>[^<]+<\/title>/i);
			expect(html).toMatch(/<meta\s+name="description"/i);
		});
	}
});

// ── Audit regressions ───────────────────────────────────────────────────

test.describe("audit regressions", () => {
	test("pricing pages render no dead video demo buttons", async ({ page }) => {
		for (const path of LOCALES.map((l) => `${localePrefix(l)}/pricing`)) {
			await page.goto(path);
			await expect(page.locator("svg.lucide-play")).toHaveCount(0);
		}
	});

	for (const locale of OTHER_LOCALES) {
		test(`${locale} home logo-rail tooltips render localized copy`, async ({
			page,
		}) => {
			const expected =
				readHomeMessages(locale).home.hero.stack.nextjs.description;
			await page.goto(`/${locale}`);
			await page.locator("img[alt='Next.js']").first().hover();
			await expect(page.getByText(expected)).toBeVisible();
		});
	}
});

// ── Security headers + kit fingerprint ──────────────────────────────────

test.describe("security headers + kit fingerprint", () => {
	test("X-Framework + security headers on landing", async ({ request }) => {
		const res = await request.get(`/${DEFAULT_LOCALE}`);
		const h = res.headers();
		expect(h["x-framework"]).toMatch(/^Fuutu-Stack\//);
		expect(h["x-frame-options"]).toBe("DENY");
		expect(h["x-content-type-options"]).toBe("nosniff");
		expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
	});

	for (const locale of OTHER_LOCALES) {
		test(`security headers on /${locale}`, async ({ request }) => {
			const res = await request.get(`/${locale}`);
			const h = res.headers();
			expect(h["x-frame-options"]).toBe("DENY");
			expect(h["x-content-type-options"]).toBe("nosniff");
		});
	}
});
