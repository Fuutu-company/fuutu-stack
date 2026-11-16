import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { consentBannerMode, consentBannerVisible } from "@fuutu/analytics";
import { expect, type Page, test } from "@playwright/test";
import { PLAN_IDS, PLANS } from "../../../packages/payments/src/config";
import { LOCALES, localePrefix } from "./locales";

/** English CTA label of every plan the marketing pricing page shows. */
function marketingPlanCtas(): string[] {
	const messages = JSON.parse(
		readFileSync(
			resolve(
				__dirname,
				"../../../packages/i18n/translations/en/common/payments.json",
			),
			"utf-8",
		),
	) as { payments: { plans: Record<string, { ctaLabel: string }> } };
	return PLAN_IDS.filter((id) => PLANS[id].showInMarketing).map(
		(id) => messages.payments.plans[id]?.ctaLabel ?? id,
	);
}

/**
 * Skips only when the analytics config this run is built with (same env)
 * switches the banner off — a banner that should show but doesn't fails.
 */
const BANNER_OFF: [boolean, string] = [
	!consentBannerVisible(),
	"Consent banner switched off by the analytics config",
];

// Base Playwright `test` on purpose: the shared fixture pre-accepts consent,
// this spec needs the banner on screen.
test.describe("consent banner", () => {
	test.skip(...BANNER_OFF);
	test.use({ viewport: { width: 1280, height: 720 } });

	test("links the privacy policy in the user's locale", async ({ page }) => {
		// Enabled locales only — a dormant one is not routable.
		for (const locale of LOCALES) {
			const href = new RegExp(`${localePrefix(locale)}/legal/privacy$`);
			await page.goto(`/${locale}`);
			const banner = page.getByRole("dialog", { name: /analytics/i });
			await expect(banner).toBeVisible({ timeout: 10_000 });
			await expect(banner.getByRole("link")).toHaveAttribute("href", href);
		}
	});

	test("never covers a focused plan CTA or the end of the page", async ({
		page,
	}) => {
		await page.goto("/en/pricing");
		const banner = page.getByRole("dialog", { name: /analytics/i });
		await expect(banner).toBeVisible({ timeout: 10_000 });

		const overlapsBanner = (selector: string, text?: string) =>
			page.evaluate(
				({ selector, text }) => {
					const bannerEl = document.querySelector('[role="dialog"]');
					const target = [...document.querySelectorAll(selector)].find(
						(el) =>
							el.getBoundingClientRect().width > 0 &&
							(text === undefined || el.textContent?.trim() === text),
					);
					if (!bannerEl || !(target instanceof HTMLElement)) {
						throw new Error(`missing ${selector} ${text ?? ""}`);
					}
					window.scrollTo(0, 0);
					target.focus();
					const b = bannerEl.getBoundingClientRect();
					const r = target.getBoundingClientRect();
					return !(
						r.bottom <= b.top ||
						r.top >= b.bottom ||
						r.right <= b.left ||
						r.left >= b.right
					);
				},
				{ selector, text },
			);

		const ctas = marketingPlanCtas();
		expect(ctas.length).toBeGreaterThan(0);
		for (const cta of ctas) {
			expect(await overlapsBanner("main a, main button", cta), cta).toBe(false);
		}

		// Scrolled to the very end, the footer ends above the banner.
		const footerClear = await page.evaluate(() => {
			window.scrollTo(0, document.documentElement.scrollHeight);
			const footer = document.querySelector("footer")?.getBoundingClientRect();
			const b = document
				.querySelector('[role="dialog"]')
				?.getBoundingClientRect();
			return footer && b ? footer.bottom <= b.top : false;
		});
		expect(footerClear).toBe(true);
	});
});

const CONSENT_COOKIE = "fuutu.consent.v1";

const banner = (page: Page) => page.getByRole("dialog", { name: /analytics/i });

/** Opens `path` and waits for the banner the config says is there. */
async function gotoWithBanner(page: Page, path: string) {
	await page.goto(path);
	await expect(banner(page)).toBeVisible({ timeout: 10_000 });
}

/** `"notice"` (OK / Opt out) or `"consent"` (Accept / Decline) — set by the build env. */
const MODE = consentBannerMode();

async function consentCookie(page: Page): Promise<string | undefined> {
	const cookies = await page.context().cookies();
	return cookies.find((c) => c.name === CONSENT_COOKIE)?.value;
}

test.describe("consent banner modes", () => {
	// Never send real analytics events from a test run.
	test.beforeEach(async ({ page }) => {
		await page.route(/\/(script\.js|api\/send)(\?|$)/, (route) =>
			route.abort(),
		);
	});

	test("notice mode: says analytics already run, OK keeps them on and hides the banner", async ({
		page,
	}) => {
		test.skip(...BANNER_OFF);
		test.skip(MODE !== "notice", "Consent mode build");
		await gotoWithBanner(page, "/en");

		await expect(banner(page)).toContainText(/cookieless analytics/i);
		await expect(banner(page)).toContainText(/opt out at any time/i);
		await banner(page).getByRole("button", { name: /^ok$/i }).click();
		await expect(banner(page)).toBeHidden();
		expect(await consentCookie(page)).toBe("acknowledged");

		await page.reload();
		await expect(page.locator("footer")).toBeVisible();
		await expect(banner(page)).toBeHidden();
	});

	test("notice mode: an opt-out is remembered across reloads", async ({
		page,
	}) => {
		test.skip(...BANNER_OFF);
		test.skip(MODE !== "notice", "Consent mode build");
		await gotoWithBanner(page, "/en");

		await banner(page)
			.getByRole("button", { name: /^opt out$/i })
			.click();
		await expect(banner(page)).toBeHidden();
		expect(await consentCookie(page)).toBe("denied");
		// A script that already loaded drops every further send (Umami's
		// `data-before-send` hook).
		const send = await page.evaluate(() => {
			const gate = (
				window as Window & {
					__fuutuUmamiBeforeSend?: (type: string, payload: object) => unknown;
				}
			).__fuutuUmamiBeforeSend;
			return gate ? gate("event", { url: "/en" }) : "no gate";
		});
		expect(send).toBeNull();

		await page.reload();
		await expect(page.locator("footer")).toBeVisible();
		await expect(banner(page)).toBeHidden();
		expect(await consentCookie(page)).toBe("denied");
		// After the reload the analytics script is not injected at all.
		await expect(page.locator("script[data-website-id]")).toHaveCount(0);
	});

	test("consent mode: asks first, Accept / Decline store the decision", async ({
		page,
	}) => {
		test.skip(...BANNER_OFF);
		test.skip(MODE !== "consent", "Notice mode build");
		await gotoWithBanner(page, "/en");

		await expect(page.locator("script[data-website-id]")).toHaveCount(0);
		await banner(page)
			.getByRole("button", { name: /^decline$/i })
			.click();
		await expect(banner(page)).toBeHidden();
		expect(await consentCookie(page)).toBe("denied");
	});

	test("footer Privacy settings reopens the banner after a decision", async ({
		page,
	}) => {
		test.skip(...BANNER_OFF);
		await gotoWithBanner(page, "/en");
		const mode = MODE;
		await banner(page)
			.getByRole("button", { name: mode === "notice" ? /^ok$/i : /^accept$/i })
			.click();
		await expect(banner(page)).toBeHidden();

		await page
			.locator("footer")
			.getByRole("button", { name: /^privacy settings$/i })
			.click();
		await expect(banner(page)).toBeVisible();
		await banner(page)
			.getByRole("button", {
				name: mode === "notice" ? /^opt out$/i : /^decline$/i,
			})
			.click();
		await expect(banner(page)).toBeHidden();
		expect(await consentCookie(page)).toBe("denied");
	});

	test("the analytics script is told to honor Do Not Track", async ({
		page,
	}) => {
		// Granted: the script loads in either banner mode.
		await page.addInitScript((name) => {
			// biome-ignore lint/suspicious/noDocumentCookie: runs before the page scripts
			document.cookie = `${name}=granted; path=/; SameSite=Lax`;
		}, CONSENT_COOKIE);
		await page.goto("/en");
		const script = page.locator("script[data-website-id]");
		const injected = await script
			.waitFor({ state: "attached", timeout: 5_000 })
			.then(() => true)
			.catch(() => false);
		test.skip(!injected, "No analytics website id in this environment");
		await expect(script).toHaveAttribute("data-do-not-track", "true");
	});
});
