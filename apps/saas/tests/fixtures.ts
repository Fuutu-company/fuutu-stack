import { test as base, expect } from "@playwright/test";

/**
 * Auto-accepts the analytics consent banner by setting a cookie
 * before any page loads. This prevents the banner from appearing
 * in screenshots and interfering with tests.
 *
 * Also hides the TanStack React Query DevTools floating button so it
 * doesn't intercept pointer events during E2E interactions.
 */
export const test = base.extend({
	page: async ({ page }, use) => {
		await page.addInitScript(() => {
			// biome-ignore lint/suspicious/noDocumentCookie: addInitScript runs before DOMContentLoaded, Cookie Store API unavailable
			document.cookie = "fuutu.consent.v1=granted; path=/; SameSite=Lax";
			// Flag to hide React Query DevTools in E2E tests
			(window as any).__PLAYWRIGHT_TEST__ = true;
			const style = document.createElement("style");
			style.textContent =
				".tsqd-parent-container { display: none !important; } .tsqd-parent-container * { pointer-events: none !important; }";
			// document.head and documentElement may both be null during very
			// early page init (before <html> is parsed). Optional chaining skips
			// the injection silently — DevTools doesn't exist at this point anyway.
			(document.head || document.documentElement)?.appendChild(style);
		});
		await use(page);
	},
});

export { expect };
