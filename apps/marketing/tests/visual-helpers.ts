import type { Locator, Page } from "@playwright/test";
import { test as base, expect, scrollThroughPage } from "./fixtures";

/** Constant "now" for every visual test — client-side dates never drift. */
export const VISUAL_NOW = new Date("2030-01-01T12:00:00.000Z");

/**
 * Attribute marking UI whose content depends on time or server-side
 * clocks (e.g. the footer year). Every visual
 * screenshot masks `[data-volatile]` — see `expectVisual`.
 */
export const VOLATILE_SELECTOR = "[data-volatile]";

type PageOptions = NonNullable<
	Parameters<ReturnType<typeof expect<Page>>["toHaveScreenshot"]>[0]
>;
type PageScreenshotOptions = Exclude<PageOptions, string>;
/** Extra masks go on top of `[data-volatile]`. */
type VisualOptions = Omit<PageScreenshotOptions, "mask"> & { mask?: Locator[] };

/** Visual-test `test`: deterministic client clock. */
export const test = base.extend({
	page: async ({ page }, use) => {
		await page.clock.setFixedTime(VISUAL_NOW);
		await use(page);
	},
});

export { expect, scrollThroughPage };

/**
 * JS-driven layout changes (`height: auto`, inline styles) are not
 * covered by `animations: "disabled"` — wait until the page height and
 * every inline opacity/transform style have stopped changing before shooting.
 */
async function waitForStableLayout(page: Page) {
	await page.evaluate(async () => {
		const sleep = (ms: number) =>
			new Promise((resolve) => setTimeout(resolve, ms));
		let last = "";
		let stable = 0;
		for (let i = 0; i < 50 && stable < 5; i++) {
			// Height plus every inline opacity/transform style: they can keep
			// changing after the height settled.
			const signature = [
				document.documentElement.scrollHeight,
				...[
					...document.querySelectorAll<HTMLElement>(
						"body [style*='opacity'], body [style*='transform']",
					),
				].map((el) => `${el.style.opacity}|${el.style.transform}`),
			].join(";");
			stable = signature === last ? stable + 1 : 0;
			last = signature;
			await sleep(100);
		}
	});
}

/**
 * The one way to take a screenshot in visual specs: masks every `[data-volatile]` element on top of caller-supplied masks.
 */
export async function expectVisual(
	target: Page | Locator,
	name: string,
	{ mask = [], ...options }: VisualOptions = {},
) {
	const page = isLocator(target) ? target.page() : target;
	await waitForStableLayout(page);
	const masks = [page.locator(VOLATILE_SELECTOR), ...mask];
	if (isLocator(target)) {
		await expect(target).toHaveScreenshot(name, { ...options, mask: masks });
		return;
	}
	await expect(target).toHaveScreenshot(name, { ...options, mask: masks });
}

function isLocator(target: Page | Locator): target is Locator {
	return typeof (target as Locator).page === "function";
}
