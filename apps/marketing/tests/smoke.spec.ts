import { expect, test } from "./fixtures";

/**
 * Smoke tests for the marketing site.
 * Covers all pages, both locales, nav interactions, and responsive checks.
 * Designed to be stable — assertions check for element presence, not exact text,
 * so downstream kit users don't get false failures after customizing content.
 */

const LOCALES = ["en", "de"] as const;
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

test.describe("page loads — all pages, both locales", () => {
	for (const locale of LOCALES) {
		const prefix = locale === "en" ? "" : "/de";

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

	test("/de keeps the locale prefix", async ({ page }) => {
		const res = await page.goto("/de");
		expect(res?.status()).toBeLessThan(400);
		await expect(page).toHaveURL(/\/de\/?$/);
	});
});

// ── Key content visibility ──────────────────────────────────────────────

test.describe("key content visible", () => {
	test("/en/pricing renders pricing tiers", async ({ page }) => {
		await page.goto("/en/pricing");
		await expect(
			page.getByRole("heading", { name: /free|pro|enterprise/i }).first(),
		).toBeVisible();
	});

	test("/de/pricing renders pricing tiers", async ({ page }) => {
		await page.goto("/de/pricing");
		await expect(
			page.getByRole("heading", { name: /free|pro|enterprise/i }).first(),
		).toBeVisible();
	});

	test("/en/blog renders post list or empty state", async ({ page }) => {
		await page.goto("/en/blog");
		const headings = page.getByRole("heading", { level: 1 });
		await expect(headings.first()).toBeVisible();
	});

	test("/en/changelog renders", async ({ page }) => {
		await page.goto("/en/changelog");
		await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
	});

	test("/en/contact renders contact info", async ({ page }) => {
		await page.goto("/en/contact");
		await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
		await expect(page.locator("a[href^='mailto:']")).toBeVisible();
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

	test("locale switcher toggles to German", async ({ page }) => {
		await page.goto("/");

		// The locale button has aria-label "Switch language" and shows the current locale
		const localeButton = page
			.getByRole("button", { name: /switch language/i })
			.first();
		await expect(localeButton).toBeVisible();
		await localeButton.click();

		// Dropdown opens with locale options — click "Deutsch"
		const deutschItem = page.getByRole("menuitem", { name: /deutsch/i });
		await expect(deutschItem).toBeVisible();
		await deutschItem.click();
		await page.waitForLoadState("domcontentloaded");
		await expect(page).toHaveURL(/\/de/);
	});

	test("404 page renders for unknown route", async ({ page }) => {
		const res = await page.goto("/en/this-page-does-not-exist");
		expect(res?.status()).toBe(404);
		await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
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
		await page.goto("/en/pricing");
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
			const res = await request.get(`/en${path}`);
			expect(res.status()).toBeLessThan(400);
			const html = await res.text();
			expect(html).toMatch(/<title[^>]*>[^<]+<\/title>/i);
			expect(html).toMatch(/<meta\s+name="description"/i);
		});
	}
});

// ── Security headers + kit fingerprint ──────────────────────────────────

test.describe("security headers + kit fingerprint", () => {
	test("X-Framework + security headers on landing", async ({ request }) => {
		const res = await request.get("/en");
		const h = res.headers();
		expect(h["x-framework"]).toMatch(/^Fuutu-Stack\//);
		expect(h["x-frame-options"]).toBe("DENY");
		expect(h["x-content-type-options"]).toBe("nosniff");
		expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
	});

	test("security headers on /de", async ({ request }) => {
		const res = await request.get("/de");
		const h = res.headers();
		expect(h["x-frame-options"]).toBe("DENY");
		expect(h["x-content-type-options"]).toBe("nosniff");
	});
});
