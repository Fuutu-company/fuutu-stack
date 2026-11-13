import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "./fixtures";

/**
 * Constant "now" for every visual test. Far enough in the future that
 * seeded data (relative to the real clock) is always in the past, so
 * derived states ("expired", "x ago") never flip between runs.
 */
export const VISUAL_NOW = new Date("2030-01-01T12:00:00.000Z");

/**
 * Attribute marking UI whose content depends on time, generated ids,
 * random seeds or data left behind by other tests. Every visual
 * screenshot masks `[data-volatile]` — see `expectVisual`.
 */
export const VOLATILE_SELECTOR = "[data-volatile]";

const VOLATILE_PLACEHOLDER = "0000-00-00 00:00:00";

type PageOptions = NonNullable<
	Parameters<ReturnType<typeof expect<Page>>["toHaveScreenshot"]>[0]
>;
type PageScreenshotOptions = Exclude<PageOptions, string>;
/** Extra masks go on top of `[data-volatile]`. */
type VisualOptions = Omit<PageScreenshotOptions, "mask"> & { mask?: Locator[] };

/**
 * Visual-test `test`: deterministic clock, and every `[data-volatile]`
 * element keeps a constant placeholder as its text. Masking alone hides
 * the pixels but not the layout — a longer timestamp or user agent still
 * widens its table column and shifts everything beside it. The observer
 * (started after `load`, i.e. after hydration) also catches rows that
 * arrive late from client-side queries.
 */
export const test = base.extend({
	page: async ({ page }, use) => {
		await page.clock.setFixedTime(VISUAL_NOW);
		await page.addInitScript(
			([selector, placeholder]) => {
				const apply = () => {
					for (const el of document.querySelectorAll(selector)) {
						if (el.textContent !== placeholder) el.textContent = placeholder;
					}
				};
				window.addEventListener("load", () => {
					apply();
					new MutationObserver(apply).observe(document.documentElement, {
						subtree: true,
						childList: true,
						characterData: true,
						attributes: true,
						attributeFilter: ["data-volatile"],
					});
				});
			},
			[VOLATILE_SELECTOR, VOLATILE_PLACEHOLDER],
		);
		await use(page);
	},
});

export { expect };

/**
 * Marks elements as volatile from the test side, for UI that cannot
 * carry the attribute itself.
 */
export async function markVolatile(locator: Locator) {
	await locator.evaluateAll((els) => {
		for (const el of els) el.setAttribute("data-volatile", "");
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
