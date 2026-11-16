import { test as base, expect } from "@playwright/test";
import { i18nConfig } from "../../../packages/i18n/config";

/** Enabled locales — the single source is `i18nConfig.locales`. */
export const LOCALES: readonly string[] = Object.keys(i18nConfig.locales);
export const DEFAULT_LOCALE: string = i18nConfig.defaultLocale;

/** URL prefix for a locale — the default locale is served unprefixed. */
export const localePrefix = (locale: string): string =>
	locale === DEFAULT_LOCALE ? "" : `/${locale}`;

/**
 * `page` with the analytics consent pre-accepted (no banner over the
 * content) and `consoleErrors`: every console error and uncaught page
 * error of the test. Only the 404 of the navigated document itself is left
 * out (the 404 tests assert that status) — a 404 for a link prefetch or
 * an asset still counts.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
	page: async ({ page }, use) => {
		await page.addInitScript(() => {
			// biome-ignore lint/suspicious/noDocumentCookie: addInitScript runs before DOMContentLoaded, Cookie Store API unavailable
			document.cookie = "fuutu.consent.v1=granted; path=/; SameSite=Lax";
		});
		await use(page);
	},
	consoleErrors: async ({ page }, use) => {
		const errors: string[] = [];
		// WebKit logs a document's 404 after the next navigation started, so
		// match on the 404 documents seen, not on the current URL.
		const notFoundDocuments = new Set<string>();
		page.on("response", (res) => {
			if (res.status() === 404 && res.request().resourceType() === "document") {
				notFoundDocuments.add(res.url());
			}
		});
		page.on("console", (msg) => {
			if (msg.type() !== "error") return;
			const ownDocument404 =
				msg.text().includes("status of 404") &&
				notFoundDocuments.has(msg.location().url);
			if (!ownDocument404) {
				errors.push(`${msg.text()} @ ${msg.location().url}`);
			}
		});
		page.on("pageerror", (err) => errors.push(err.message));
		await use(errors);
	},
});

export { expect };
