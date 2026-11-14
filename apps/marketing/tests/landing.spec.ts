import { contrastRatio, type Vec3, WCAG_AA } from "@fuutu/ui/color";
import { expect, scrollThroughPage, test } from "./fixtures";
import { DEFAULT_LOCALE, OTHER_LOCALES, readHomeMessages } from "./locales";

/**
 * Landing page contract: the product window with its floating activity
 * cards, the cut-out icons on those cards, the product tour tabs and the
 * screenshots. Assertions use structure and ARIA, not copy, so a downstream
 * product can rewrite every word without breaking them.
 */

const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
	test.describe(`landing hero — ${theme}`, () => {
		test.beforeEach(async ({ page }) => {
			await page.addInitScript((value) => {
				try {
					localStorage.setItem("theme", value);
				} catch {
					// storage unavailable — runs in the default theme
				}
			}, theme);
		});

		test("four floating cards, each with a cut-out icon in the card's own surface color", async ({
			page,
			isMobile,
		}) => {
			test.skip(isMobile, "desktop layout shows all four cards");
			await page.setViewportSize({ width: 1280, height: 900 });
			await page.goto(`/${DEFAULT_LOCALE}`);
			await expect(page.locator("html")).toHaveClass(new RegExp(theme));

			const floats = page.locator('[data-slot="hero-float"]');
			await expect(floats).toHaveCount(4);

			for (let i = 0; i < 4; i++) {
				const float = floats.nth(i);
				await expect(float).toBeVisible();
				// Lucide icons, no emoji glyphs.
				await expect(float).not.toHaveText(/\p{Extended_Pictographic}/u);

				const icon = await float
					.locator('[data-slot="cutout-icon"]')
					.evaluate((root) => {
						const card = root.closest('[data-slot="hero-float"]');
						const tile = root.querySelector('[data-slot="cutout-icon-tile"]');
						const svg = root.querySelector("svg");
						if (!card || !tile || !svg) return null;
						const t = tile.getBoundingClientRect();
						const s = svg.getBoundingClientRect();
						return {
							cardBackground: getComputedStyle(card).backgroundColor,
							tileBackground: getComputedStyle(tile).backgroundColor,
							stroke: getComputedStyle(svg).stroke,
							svgLarger: s.width > t.width && s.height > t.height,
							centered:
								Math.abs(s.left + s.width / 2 - (t.left + t.width / 2)) < 1 &&
								Math.abs(s.top + s.height / 2 - (t.top + t.height / 2)) < 1,
						};
					});

				expect(icon).not.toBeNull();
				expect(icon?.stroke).toBe(icon?.cardBackground);
				expect(icon?.tileBackground).not.toBe(icon?.cardBackground);
				expect(icon?.svgLarger).toBe(true);
				expect(icon?.centered).toBe(true);
			}
		});
	});
}

test("headline highlight is the area marker, not the browser's yellow mark", async ({
	page,
}) => {
	await page.goto(`/${DEFAULT_LOCALE}`);
	const style = await page
		.locator('[data-slot="hero"] h1 mark')
		.evaluate((mark) => {
			const computed = getComputedStyle(mark);
			const probe = document.createElement("span");
			probe.style.color = "var(--area-billing)";
			document.body.append(probe);
			const marker = getComputedStyle(probe).color;
			probe.remove();
			// Painted with the area token: a gradient shape (fallback) or the
			// token as a solid fill on the trimmed inline box.
			return {
				usesAreaMarker:
					computed.backgroundImage.includes("gradient") ||
					computed.backgroundColor === marker,
				inheritsColor:
					computed.color ===
					getComputedStyle(mark.parentElement as Element).color,
			};
		});
	expect(style).toEqual({
		usesAreaMarker: true,
		inheritsColor: true,
	});
});

/**
 * The marker must read as a full highlighter stroke: from just above the cap
 * height to below the descenders on every line the phrase wraps onto, without
 * climbing into the line above, where it would cover that line's descenders.
 * Measured against the rendered glyph box (canvas font metrics), so it holds
 * for any heading font. Headline text on it ≥ 4.5:1.
 */
for (const theme of THEMES) {
	for (const locale of [DEFAULT_LOCALE, ...OTHER_LOCALES]) {
		for (const width of [1280, 375]) {
			test(`headline marker covers caps to descenders (${locale}, ${width}px, ${theme})`, async ({
				page,
			}) => {
				await page.emulateMedia({ reducedMotion: "reduce" });
				await page.addInitScript((value) => {
					try {
						localStorage.setItem("theme", value);
					} catch {
						// storage unavailable — runs in the default theme
					}
				}, theme);
				await page.setViewportSize({ width, height: 900 });
				await page.goto(locale === DEFAULT_LOCALE ? "/" : `/${locale}`);
				await expect(page.locator("html")).toHaveClass(new RegExp(theme));
				const h1 = page.locator('[data-slot="hero"] h1');
				await h1.evaluate(() => document.fonts.ready);
				const h1Box = await h1.boundingBox();
				if (!h1Box) throw new Error("hero headline not rendered");
				// Inline boxes overhang the tight line-height: pad the clip so the
				// last line's descenders are inside the screenshot.
				const pad = 48;
				const box = {
					x: h1Box.x,
					y: Math.max(0, h1Box.y - pad),
					width: h1Box.width,
					height: h1Box.height + 2 * pad,
				};
				const png = await page.screenshot({
					clip: box,
					scale: "css",
					animations: "disabled",
				});

				const result = await h1.evaluate(
					async (el, { b64, origin }) => {
						const mark = el.querySelector("mark");
						if (!mark) return null;
						const cs = getComputedStyle(el);
						const ctx = document
							.createElement("canvas")
							.getContext("2d", { willReadFrequently: true });
						if (!ctx) return null;
						const rgbOf = (color: string) => {
							ctx.canvas.width = 1;
							ctx.canvas.height = 1;
							ctx.clearRect(0, 0, 1, 1);
							ctx.fillStyle = color;
							ctx.fillRect(0, 0, 1, 1);
							return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
						};
						const probe = document.createElement("span");
						probe.style.color = "var(--area-billing)";
						document.body.append(probe);
						const marker = rgbOf(getComputedStyle(probe).color);
						probe.remove();
						const ink = rgbOf(getComputedStyle(mark).color);

						ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
						const cap = ctx.measureText("H").actualBoundingBoxAscent;
						const descent = ctx.measureText("gjpqy").actualBoundingBoxDescent;
						const ascent = ctx.measureText("Hg").fontBoundingBoxAscent;

						const img = new Image();
						img.src = `data:image/png;base64,${b64}`;
						await img.decode();
						ctx.canvas.width = img.width;
						ctx.canvas.height = img.height;
						ctx.drawImage(img, 0, 0);
						const pixel = (x: number, y: number) => [
							...ctx.getImageData(
								Math.round(x - origin.x),
								Math.round(y - origin.y),
								1,
								1,
							).data,
						];
						const near = (a: number[], b: number[], tolerance: number) =>
							[0, 1, 2].every(
								(i) => Math.abs((a[i] ?? 0) - (b[i] ?? 0)) <= tolerance,
							);
						// The rendered marker, read in the fragment's inline padding at
						// mid-x-height (no glyph ink there); the screenshot's color
						// pipeline can shift it a little from the token's canvas value.
						let painted: number[] = [];
						const isMarker = (x: number, y: number) =>
							near(pixel(x, y), painted, 6);
						/** Share of marker pixels along a row, inside the fragment's padding-free middle. */
						const rowShare = (rect: DOMRect, y: number) => {
							let hits = 0;
							let total = 0;
							for (
								let x = rect.left + rect.width * 0.1;
								x < rect.right - rect.width * 0.1;
								x += 1
							) {
								total += 1;
								if (isMarker(x, y)) hits += 1;
							}
							return total ? hits / total : 0;
						};

						// Text lines come from a range over the mark's text: its rects
						// follow the font's own ascent/descent, whatever box the mark's
						// decoration paints, so the baseline is font-independent.
						const range = document.createRange();
						range.selectNodeContents(mark);
						const lines = [...range.getClientRects()].filter(
							(line) => line.width > 0,
						);
						const boxes = [...mark.getClientRects()];
						const fontSize = Number.parseFloat(cs.fontSize);
						/** Contiguous marker rows (px) going up from `y`. */
						const climb = (rect: DOMRect, y: number) => {
							let rows = 0;
							while (rows < fontSize && rowShare(rect, y - rows) > 0.5)
								rows += 1;
							return rows;
						};
						const fragments = lines.map((line, index) => {
							const rect = boxes[index] ?? line;
							const baseline = line.top + ascent;
							painted = pixel(rect.left + 2, baseline - cap / 2);
							return {
								paintedIsToken: near(painted, marker, 24),
								aboveCaps: rowShare(rect, baseline - cap - 1),
								belowDescenders: rowShare(rect, baseline + descent),
								// How far the marker climbs above the cap line before a gap:
								// a merge with the line above's marker would run on for ~1em.
								climbAboveCaps: climb(rect, baseline - cap - 1),
								fontSize,
							};
						});
						return {
							fragments,
							boxCount: boxes.length,
							decorationBreak:
								getComputedStyle(mark).boxDecorationBreak ||
								getComputedStyle(mark).getPropertyValue(
									"-webkit-box-decoration-break",
								),
							marker,
							ink,
						};
					},
					{ b64: png.toString("base64"), origin: { x: box.x, y: box.y } },
				);

				expect(result).not.toBeNull();
				if (!result) return;
				expect(result.decorationBreak).toBe("clone");
				expect(result.fragments.length).toBeGreaterThan(0);
				expect(result.fragments).toHaveLength(result.boxCount);
				for (const fragment of result.fragments) {
					expect(fragment.paintedIsToken).toBe(true);
					expect(fragment.aboveCaps).toBeGreaterThan(0.7);
					expect(fragment.belowDescenders).toBeGreaterThan(0.7);
					expect(fragment.climbAboveCaps).toBeLessThan(
						fragment.fontSize * 0.12,
					);
				}
				const ratio = contrastRatio(
					result.ink.map((c) => c / 255) as Vec3,
					result.marker.map((c) => c / 255) as Vec3,
				);
				expect(ratio).toBeGreaterThanOrEqual(WCAG_AA.text);
			});
		}
	}
}

test("hero has no announcement badge above the headline", async ({ page }) => {
	await page.goto(`/${DEFAULT_LOCALE}`);
	const hero = page.locator('[data-slot="hero"]');
	await expect(hero.locator("h1")).toBeVisible();
	await expect(hero.locator('[data-slot="area-badge"]')).toHaveCount(0);
});

test("mobile: exactly one floating card stays visible", async ({ page }) => {
	await page.setViewportSize({ width: 375, height: 812 });
	await page.goto(`/${DEFAULT_LOCALE}`);
	const floats = page.locator('[data-slot="hero-float"]');
	await expect(floats).toHaveCount(4);
	await expect(floats.filter({ visible: true })).toHaveCount(1);
});

test("section headings stand alone, without a kicker chip above them", async ({
	page,
}) => {
	await page.goto(`/${DEFAULT_LOCALE}`);
	const headings = page.locator("main h2");
	expect(await headings.count()).toBeGreaterThan(3);
	const kickers = await headings.evaluateAll(
		(nodes) =>
			nodes.filter((h2) =>
				h2.previousElementSibling?.matches('[data-slot="area-badge"]'),
			).length,
	);
	expect(kickers).toBe(0);
});

test("navbar stays visible as a floating pill while scrolling", async ({
	page,
}) => {
	await page.goto(`/${DEFAULT_LOCALE}`);
	await page.evaluate(() => window.scrollTo(0, 2400));
	const nav = page.locator("header nav").first();
	await expect(nav).toBeInViewport();
	const box = await nav.boundingBox();
	expect(box?.y ?? -1).toBeGreaterThan(0);
	expect(box?.y ?? 999).toBeLessThan(40);
});

test.describe("product tour", () => {
	test("tabs follow the ARIA tabs pattern and switch the screenshot", async ({
		page,
	}) => {
		await page.goto(`/${DEFAULT_LOCALE}`);
		const tour = page.locator("#tour");
		const tabs = tour.getByRole("tablist").getByRole("tab");
		await expect(tabs).toHaveCount(4);
		await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

		const panel = tour.getByRole("tabpanel");
		await expect(panel).toHaveCount(1);
		const firstShot = await panel.locator("img").getAttribute("src");

		await tabs.nth(1).click();
		await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
		await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "false");
		await expect(tour.getByRole("tabpanel")).toHaveCount(1);
		await expect(tour.getByRole("tabpanel").locator("img")).not.toHaveAttribute(
			"src",
			firstShot ?? "",
		);

		// Keyboard: arrows move and select, Home/End jump, wrap-around.
		await tabs.nth(1).focus();
		await page.keyboard.press("ArrowRight");
		await expect(tabs.nth(2)).toBeFocused();
		await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
		await page.keyboard.press("End");
		await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");
		await page.keyboard.press("ArrowRight");
		await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
		await page.keyboard.press("ArrowLeft");
		await expect(tabs.nth(3)).toHaveAttribute("aria-selected", "true");

		const labelledBy = await tour
			.getByRole("tabpanel")
			.getAttribute("aria-labelledby");
		expect(labelledBy).toBe(await tabs.nth(3).getAttribute("id"));
	});
});

test("every visible landing screenshot loads and has alt text", async ({
	page,
}) => {
	await page.goto(`/${DEFAULT_LOCALE}`);
	await scrollThroughPage(page);
	const shots = page
		.locator('img[data-slot="screen"]')
		.filter({ visible: true });
	expect(await shots.count()).toBeGreaterThanOrEqual(2);
	const states = await shots.evaluateAll((imgs) =>
		(imgs as HTMLImageElement[]).map((img) => ({
			loaded: img.complete && img.naturalWidth > 0,
			alt: img.alt.trim().length > 0,
		})),
	);
	for (const state of states)
		expect(state).toEqual({ loaded: true, alt: true });
});

for (const width of [1280, 375]) {
	test(`screenshots are crisp on a 2x display (${width}px)`, async ({
		browser,
		baseURL,
	}) => {
		const context = await browser.newContext({
			baseURL,
			viewport: { width, height: 900 },
			deviceScaleFactor: 2,
		});
		const page = await context.newPage();
		await page.goto(`/${DEFAULT_LOCALE}`);
		await scrollThroughPage(page);
		const shots = page
			.locator('img[data-slot="screen"]')
			.filter({ visible: true });
		expect(await shots.count()).toBeGreaterThanOrEqual(2);
		const states = await shots.evaluateAll((imgs) =>
			(imgs as HTMLImageElement[]).map((img) => {
				const src = new URL(img.currentSrc, location.href);
				const optimized = src.pathname === "/_next/image";
				return {
					// Enough source pixels for every device pixel it is drawn on.
					sharp:
						img.naturalWidth >=
						img.getBoundingClientRect().width * window.devicePixelRatio,
					// Not recompressed below near-lossless quality.
					highQuality:
						!optimized || Number(src.searchParams.get("q") ?? 0) >= 90,
				};
			}),
		);
		for (const state of states)
			expect(state).toEqual({ sharp: true, highQuality: true });
		await context.close();
	});
}

for (const locale of OTHER_LOCALES) {
	test(`${locale}: hero screenshot carries localized alt text`, async ({
		page,
	}) => {
		const template = readHomeMessages(locale).home.hero.screenshotAlt;
		expect(template).not.toBe(
			readHomeMessages(DEFAULT_LOCALE).home.hero.screenshotAlt,
		);
		// The message is ICU with `{appName}`; match the rest literally.
		const expected = new RegExp(
			`^${template
				.split("{appName}")
				.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
				.join(".+")}$`,
		);
		await page.goto(`/${locale}`);
		await expect(
			page.locator('[data-slot="hero"]').getByRole("img", { name: expected }),
		).toBeVisible();
	});
}

test.describe("FAQ", () => {
	test("sits between pricing and the closing call to action", async ({
		page,
	}) => {
		await page.goto(`/${DEFAULT_LOCALE}`);
		const order = await page.evaluate(() => {
			const top = (selector: string) =>
				document.querySelector(selector)?.getBoundingClientRect().top ?? null;
			return {
				pricing: top("#pricing"),
				faq: top("#faq"),
				cta: top("#faq ~ section"),
			};
		});
		expect(order.faq).not.toBeNull();
		expect(order.pricing).not.toBeNull();
		expect(order.cta).not.toBeNull();
		expect(order.faq ?? 0).toBeGreaterThan(order.pricing ?? 0);
		expect(order.cta ?? 0).toBeGreaterThan(order.faq ?? 0);
	});

	test("items expand and collapse with the keyboard", async ({ page }) => {
		await page.goto(`/${DEFAULT_LOCALE}`);
		const faq = page.locator("#faq");
		await expect(faq.getByRole("heading", { level: 2 })).toBeVisible();
		const triggers = faq.getByRole("button");
		expect(await triggers.count()).toBeGreaterThanOrEqual(6);
		for (const trigger of await triggers.all())
			await expect(trigger).toHaveAttribute("aria-expanded", "false");

		const first = triggers.first();
		await first.focus();
		await page.keyboard.press("Enter");
		await expect(first).toHaveAttribute("aria-expanded", "true");
		const panelId = await first.getAttribute("aria-controls");
		expect(panelId).toBeTruthy();
		await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();

		await page.keyboard.press("Space");
		await expect(first).toHaveAttribute("aria-expanded", "false");
		await expect(page.locator(`[id="${panelId}"]`)).toBeHidden();

		await page.keyboard.press("Tab");
		await expect(triggers.nth(1)).toBeFocused();
	});

	test("FAQPage structured data lists exactly the visible questions", async ({
		page,
	}) => {
		await page.goto(`/${DEFAULT_LOCALE}`);
		const data = await page
			.locator('#faq script[type="application/ld+json"]')
			.evaluate((node) => JSON.parse(node.textContent ?? "null"));
		expect(data["@type"]).toBe("FAQPage");
		const names = (data.mainEntity as { name: string }[]).map((q) => q.name);
		const visible = await page
			.locator("#faq")
			.getByRole("button")
			.allInnerTexts();
		expect(names.length).toBeGreaterThanOrEqual(6);
		expect(names).toEqual(visible.map((text) => text.trim()));
		for (const question of data.mainEntity as {
			acceptedAnswer: { text: string };
		}[])
			expect(question.acceptedAnswer.text.length).toBeGreaterThan(0);
	});

	for (const locale of OTHER_LOCALES) {
		test(`${locale}: questions are translated`, async ({ page }) => {
			await page.goto(`/${DEFAULT_LOCALE}`);
			const defaultFirst = await page
				.locator("#faq")
				.getByRole("button")
				.first()
				.innerText();
			await page.goto(`/${locale}`);
			const first = page.locator("#faq").getByRole("button").first();
			await expect(first).toBeVisible();
			expect(await first.innerText()).not.toBe(defaultFirst);
		});
	}
});
