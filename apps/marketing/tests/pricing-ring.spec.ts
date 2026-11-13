import { expect, test } from "./fixtures";
import { DEFAULT_LOCALE } from "./locales";

/**
 * The highlighted tier draws a 2px ink ring outside its box. Any clipping
 * ancestor (the matrix sits in an `overflow-x-auto` wrapper) must leave room
 * for it on every side, or the ring and the "Most popular" badge get cut.
 */
test.describe("pricing highlight ring", () => {
	for (const width of [1280, 375]) {
		test(`highlighted tier ring is fully visible on /pricing (${width}px)`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto(`/${DEFAULT_LOCALE}/pricing`);
			const card = page
				.locator("[data-slot='pricing-tier'][data-highlighted]")
				.filter({ visible: true });
			await expect(card).toHaveCount(1, { timeout: 10_000 });

			const clipped = await card.evaluate((el) => {
				const RING = 2;
				const box = el.getBoundingClientRect();
				const cuts: string[] = [];
				for (let node = el.parentElement; node; node = node.parentElement) {
					const cs = getComputedStyle(node);
					const clipX = cs.overflowX !== "visible";
					const clipY = cs.overflowY !== "visible";
					if (!clipX && !clipY) continue;
					const clip = node.getBoundingClientRect();
					const name = String(node.className);
					if (clipY && box.top - RING < clip.top) cuts.push(`top: ${name}`);
					if (clipX && box.left - RING < clip.left) cuts.push(`left: ${name}`);
					if (clipX && box.right + RING > clip.right)
						cuts.push(`right: ${name}`);
				}
				return cuts;
			});
			expect(clipped).toEqual([]);
		});
	}
});
