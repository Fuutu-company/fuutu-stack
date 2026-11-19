import { isKitPathEnabled } from "../src/lib/kit-routes";
import { expect, test } from "./fixtures";

/**
 * Regression: `main` used `overflow-x-hidden`, which forces `overflow-y` to
 * `auto` and clips everything that paints below the last block (the shadow,
 * ring and focus ring of the last changelog entry or blog card). Horizontal
 * overflow must be clipped without making `main` clip vertically.
 */
for (const path of ["/changelog", "/blog"].filter(isKitPathEnabled)) {
	test(`${path}: the last entry is not clipped at the bottom`, async ({
		page,
	}) => {
		await page.goto(path);
		const main = page.locator("main");
		const overflow = await main.evaluate((element) => {
			const style = getComputedStyle(element);
			return { x: style.overflowX, y: style.overflowY };
		});
		expect(overflow.y).toBe("visible");
		expect(["clip", "visible"]).toContain(overflow.x);

		// Nothing between the last card and the page clips it vertically.
		const card = main.locator("li, article").last();
		const clippingAncestors = await card.evaluate((element) => {
			const clipped: string[] = [];
			for (
				let node = element.parentElement;
				node && node !== document.body;
				node = node.parentElement
			) {
				if (getComputedStyle(node).overflowY !== "visible") {
					clipped.push(`${node.tagName}.${node.className}`);
				}
			}
			return clipped;
		});
		expect(clippingAncestors).toEqual([]);
	});
}
