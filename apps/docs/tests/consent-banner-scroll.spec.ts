import { expect, type Page, test } from "@playwright/test";

// Base Playwright `test` on purpose: the shared fixture pre-accepts consent,
// this spec needs the banner on screen.

const banner = (page: Page) => page.getByRole("dialog", { name: /analytics/i });

/** Tops of the shell parts that must stay put: the visible header(s) and the desktop sidebar. */
const shellTops = (page: Page) =>
	page.evaluate(() => {
		const visible = (el: Element) => {
			const box = el.getBoundingClientRect();
			return box.width > 0 && box.height > 0;
		};
		const parts = [...document.querySelectorAll("header, #nd-sidebar")].filter(
			visible,
		);
		return parts.map((el) => ({
			name: el.id || el.tagName.toLowerCase(),
			top: Math.round(el.getBoundingClientRect().top),
		}));
	});

test.describe("consent banner and page end", () => {
	test("the navigation stays in place and the page end clears the banner", async ({
		page,
	}) => {
		await page.goto("/docs");
		const shown = await banner(page)
			.waitFor({ state: "visible", timeout: 5_000 })
			.then(() => true)
			.catch(() => false);
		test.skip(!shown, "Consent banner disabled");

		// Content-independent: a tall last line, so the page always scrolls.
		await page.evaluate(() => {
			const end = document.createElement("div");
			end.id = "test-page-end";
			end.style.height = "3000px";
			end.textContent = "end";
			document.querySelector("#nd-page")?.append(end);
		});

		const before = await shellTops(page);
		expect(before.length).toBeGreaterThan(0);

		await page.evaluate(() =>
			window.scrollTo(0, document.documentElement.scrollHeight),
		);
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						Math.ceil(window.scrollY + window.innerHeight) >=
						document.documentElement.scrollHeight - 1,
				),
			)
			.toBe(true);

		const after = await shellTops(page);
		expect(after.map((part) => part.name)).toEqual(
			before.map((part) => part.name),
		);
		for (const [index, part] of after.entries()) {
			expect(
				Math.abs(part.top - (before[index]?.top ?? 0)),
			).toBeLessThanOrEqual(1);
		}

		const bannerTop = (await banner(page).boundingBox())?.y ?? 0;
		const endBottom = await page
			.locator("#test-page-end")
			.evaluate((el) => el.getBoundingClientRect().bottom);
		expect(endBottom).toBeLessThanOrEqual(bannerTop + 1);
	});
});
