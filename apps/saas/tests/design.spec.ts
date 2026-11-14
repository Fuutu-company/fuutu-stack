import { config } from "@fuutu/config";
import { CONTRAST_PAIRS } from "@fuutu/ui/color";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { expectedFontFamily } from "./font-families";

// The style guide is optional: buyers turn it off before launch.
test.skip(!config.features.designSystem, "config.features.designSystem is off");

const SECTION_IDS = [
	"foundations",
	"components",
	"patterns",
	"do-dont",
	"example",
];

function collectErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on("pageerror", (err) => errors.push(err.message));
	page.on("console", (msg) => {
		if (msg.type() === "error") errors.push(msg.text());
	});
	return errors;
}

test.describe("/design", () => {
	test("Administration group lists Design system directly below Admin and not under Platform", async ({
		page,
		isMobile,
	}) => {
		test.skip(isMobile, "Sidebar navigation works differently on mobile");
		await page.goto("/dashboard");

		const sidebar = page.locator("[data-sidebar='sidebar']");
		const group = (name: RegExp) =>
			sidebar.locator("[data-sidebar='group']").filter({
				has: page.locator("[data-sidebar='group-label']", { hasText: name }),
			});
		const administration = group(/^administration$/i);
		await expect(administration).toBeVisible({ timeout: 10_000 });
		// Top-level entries of the group, in order: the collapsible Admin group,
		// then Design system as its own link directly below it.
		const entries = administration.locator(
			"[data-sidebar='menu'] > [data-sidebar='menu-item'] > [data-sidebar='menu-button']",
		);
		await expect(entries).toHaveText([/^admin$/i, /^design system$/i]);
		await expect(
			administration.locator(
				"[data-sidebar='menu'] > [data-sidebar='menu-item']",
			),
		).toHaveCount(2);
		await expect(
			administration
				.locator("[data-sidebar='menu'] > [data-sidebar='menu-item']")
				.first(),
		).toHaveAttribute("data-nav-group", "admin");
		await expect(entries.nth(1)).toHaveAttribute("href", "/design");
		await expect(
			group(/^platform$/i).getByRole("link", { name: /^design system$/i }),
		).toHaveCount(0);

		await administration
			.getByRole("link", { name: /^design system$/i })
			.click();

		await expect(page).toHaveURL(/\/design$/);
		await expect(
			page.getByRole("heading", { level: 1, name: /^design system$/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(page.locator("header [aria-current='page']")).toHaveText(
			/^design system$/i,
		);
		await expect(
			administration.getByRole("link", { name: /^design system$/i }),
		).toHaveAttribute("data-active", "true");
	});

	test("has no console errors in light and dark", async ({ page }) => {
		const errors = collectErrors(page);
		await page.goto("/design");
		await expect(
			page.getByRole("heading", { level: 1, name: /^design system$/i }),
		).toBeVisible({
			timeout: 10_000,
		});

		const html = page.locator("html");
		const wasDark = await html.evaluate((el) => el.classList.contains("dark"));
		await page
			.getByRole("region", { name: /^design system$/i })
			.getByRole("button", { name: /toggle theme/i })
			.click();
		await expect
			.poll(() => html.evaluate((el) => el.classList.contains("dark")))
			.toBe(!wasDark);

		expect(errors).toEqual([]);
	});

	test("every anchor in the page nav targets a titled section", async ({
		page,
	}) => {
		await page.goto("/design");
		const nav = page.getByRole("navigation", { name: /on this page/i });
		const hrefs = await nav
			.getByRole("link")
			.evaluateAll((links) => links.map((a) => a.getAttribute("href")));
		expect(hrefs).toEqual(SECTION_IDS.map((id) => `#${id}`));

		for (const id of SECTION_IDS) {
			const section = page.locator(`section#${id}`);
			await expect(section).toHaveCount(1);
			await expect(section.getByRole("heading", { level: 2 })).toBeVisible();
		}
	});

	test("data-preview pins hover, focus-visible and active without interaction", async ({
		page,
	}) => {
		await page.goto("/design");
		await expect(
			page.getByRole("heading", { level: 1, name: /^design system$/i }),
		).toBeVisible({
			timeout: 10_000,
		});

		// Class strings the app already ships (Button default, sidebar menu
		// button), so they are in the compiled CSS.
		const result = await page.evaluate(() => {
			const make = (className: string, preview?: string) => {
				const el = document.createElement("button");
				el.className = className;
				if (preview) el.dataset.preview = preview;
				document.body.append(el);
				return getComputedStyle(el);
			};
			const hover = "bg-primary hover:bg-primary/90";
			const active = "bg-transparent active:bg-sidebar-accent";
			const ring = "focus-visible:ring-[3px]";
			const both = make(`${hover} ${ring}`, "hover focus-visible");
			return {
				hoverIdle: make(hover).backgroundColor,
				hoverPinned: make(hover, "hover").backgroundColor,
				activeIdle: make(active).backgroundColor,
				activePinned: make(active, "active").backgroundColor,
				ringIdle: make(ring).boxShadow,
				ringPinned: make(ring, "focus-visible").boxShadow,
				bothBackground: both.backgroundColor,
				bothRing: both.boxShadow,
			};
		});

		expect(result.hoverPinned).not.toBe(result.hoverIdle);
		expect(result.activePinned).not.toBe(result.activeIdle);
		expect(result.ringIdle).toBe("none");
		expect(result.ringPinned).not.toBe("none");
		// Space-separated states combine (`~=` match).
		expect(result.bothBackground).toBe(result.hoverPinned);
		expect(result.bothRing).toBe(result.ringPinned);
	});

	test("every contrast badge passes in light and dark", async ({ page }) => {
		const errors = collectErrors(page);
		await page.goto("/design");
		await expect(
			page.getByRole("heading", { level: 1, name: /^design system$/i }),
		).toBeVisible({
			timeout: 10_000,
		});

		const badges = page.getByTestId("contrast-badge");
		const html = page.locator("html");
		const readRatios = () =>
			badges.evaluateAll((els) => els.map((el) => el.textContent ?? ""));

		await expect(badges).toHaveCount(CONTRAST_PAIRS.length);
		await expect(
			page.locator("[data-testid='contrast-badge'][data-pass='true']"),
		).toHaveCount(CONTRAST_PAIRS.length);
		const before = await readRatios();
		const wasDark = await html.evaluate((el) => el.classList.contains("dark"));

		await page
			.getByRole("region", { name: /^design system$/i })
			.getByRole("button", { name: /toggle theme/i })
			.click();
		await expect
			.poll(() => html.evaluate((el) => el.classList.contains("dark")))
			.toBe(!wasDark);

		await expect
			.poll(async () => (await readRatios()).join("|") !== before.join("|"))
			.toBe(true);
		await expect(
			page.locator("[data-testid='contrast-badge'][data-pass='true']"),
		).toHaveCount(CONTRAST_PAIRS.length);

		// Put the theme back.
		await page
			.getByRole("region", { name: /^design system$/i })
			.getByRole("button", { name: /toggle theme/i })
			.click();
		expect(errors).toEqual([]);
	});

	test("palette shows a runtime value for every token", async ({ page }) => {
		await page.goto("/design");
		const tokens = page.getByTestId("palette-token");
		await expect(tokens.first()).toBeVisible({ timeout: 10_000 });
		await expect(tokens).toHaveCount(45);
		await expect
			.poll(() =>
				page
					.getByTestId("palette-value")
					.evaluateAll((els) =>
						els.every((el) => /^#[0-9a-f]{6}$/.test(el.textContent ?? "")),
					),
			)
			.toBe(true);
	});

	for (const mode of ["light", "dark"] as const) {
		test(`no horizontal overflow at 375px in ${mode}`, async ({ page }) => {
			await page.setViewportSize({ width: 375, height: 800 });
			await page.emulateMedia({ colorScheme: mode });
			await page.goto("/design");
			await expect(
				page.getByRole("heading", { level: 1, name: /^design system$/i }),
			).toBeVisible({
				timeout: 10_000,
			});
			await page.evaluate(
				(value) => localStorage.setItem("theme", value),
				mode,
			);
			await page.reload();
			await expect(page.locator("html")).toHaveClass(
				mode === "dark" ? /dark/ : /^((?!dark).)*$/,
			);

			const overflow = await page.evaluate(() => ({
				scrollWidth: document.documentElement.scrollWidth,
				innerWidth: window.innerWidth,
				offenders: [...document.querySelectorAll("main *")]
					.filter(
						(el) => el.getBoundingClientRect().right > window.innerWidth + 1,
					)
					.filter((el) => {
						// Content inside a clipping/scrolling ancestor cannot widen the page.
						for (
							let node = el.parentElement;
							node && node.tagName !== "MAIN";
							node = node.parentElement
						) {
							if (getComputedStyle(node).overflowX !== "visible") return false;
						}
						return true;
					})
					.slice(0, 5)
					.map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`),
			}));
			expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
			expect(overflow.offenders).toEqual([]);
		});
	}

	test("pinned hover button differs from default", async ({ page }) => {
		await page.goto("/design");
		const section = page.locator("section#components");
		const idle = section
			.locator(
				"button[data-variant='default']:not([data-preview]):not([disabled])",
			)
			.first();
		const pinned = section
			.locator("button[data-preview='hover'][data-variant='default']")
			.first();
		await expect(pinned).toBeVisible({ timeout: 10_000 });
		await pinned.scrollIntoViewIfNeeded();

		const background = (locator: typeof idle) =>
			locator.evaluate((el) => getComputedStyle(el).backgroundColor);
		await expect
			.poll(async () => (await background(pinned)) !== (await background(idle)))
			.toBe(true);
	});

	test("Tactile shapes", async ({ page }) => {
		await page.goto("/design");
		const section = page.locator("section#components");
		const button = section
			.locator(
				"button[data-slot='button'][data-variant='default'][data-size='default']:not([data-preview]):not([disabled])",
			)
			.first();
		await expect(button).toBeVisible({ timeout: 10_000 });

		const style = (selector: string) =>
			section
				.locator(selector)
				.first()
				.evaluate((el) => {
					const cs = getComputedStyle(el);
					return {
						radius: Number.parseFloat(cs.borderTopLeftRadius),
						height: el.getBoundingClientRect().height,
						border: Number.parseFloat(cs.borderTopWidth),
					};
				});

		const btn = await style(
			"button[data-slot='button'][data-variant='default'][data-size='default']:not([data-preview]):not([disabled])",
		);
		expect(btn.height).toBe(40);
		expect(btn.radius).toBeGreaterThanOrEqual(btn.height / 2);

		const card = await style("[data-slot='card']");
		expect(card.radius).toBe(24);
		expect(card.border).toBe(0);

		const input = await style("input[data-slot='input']");
		expect(input.radius).toBe(14);
		expect(input.border).toBe(1);

		const checkbox = await style("[data-slot='checkbox']");
		expect(checkbox.radius).toBe(4);

		const transitioned = () =>
			button.evaluate((el) =>
				getComputedStyle(el)
					.transitionProperty.split(",")
					.map((p) => p.trim())
					.some((p) => p === "transform" || p === "all"),
			);
		expect(await transitioned()).toBe(true);
		await page.emulateMedia({ reducedMotion: "reduce" });
		expect(await transitioned()).toBe(false);
	});

	test("type specimen renders the display and body fonts with role classes", async ({
		page,
	}) => {
		await page.goto("/design");
		const section = page.locator("section#foundations");
		const display = section.locator("[data-type-role='display'] p").last();
		await expect(display).toBeVisible({ timeout: 10_000 });
		const display800 = await display.evaluate((el) => {
			const cs = getComputedStyle(el);
			return { family: cs.fontFamily, weight: cs.fontWeight };
		});
		expect(display800.family).toMatch(expectedFontFamily("heading"));
		expect(display800.weight).toBe("800");
		const body = section.locator("[data-type-role='body'] p").last();
		expect(
			await body.evaluate((el) => getComputedStyle(el).fontFamily),
		).toMatch(expectedFontFamily("sans"));
		const mono = section.locator("[data-type-role='mono'] p").last();
		expect(
			await mono.evaluate((el) => getComputedStyle(el).fontFamily),
		).toMatch(expectedFontFamily("mono"));
	});

	test("scales show radius sm to 4xl and shadows 2xs to 2xl", async ({
		page,
	}) => {
		await page.goto("/design");
		const section = page.locator("section#foundations");
		const radii = section.getByTestId("radius-step");
		await expect(radii).toHaveCount(7, { timeout: 10_000 });
		await expect(radii.last()).toContainText("rounded-4xl");
		const shadows = section.getByTestId("elevation-level");
		await expect(shadows).toHaveCount(7);
		await expect(shadows.first()).toContainText("shadow-2xs");
		await expect(shadows.last()).toContainText("shadow-2xl");
	});

	test("area tiles and swatches name their tokens", async ({ page }) => {
		await page.goto("/design");
		const swatches = page
			.locator("section#foundations")
			.getByTestId("area-swatch");
		await expect(swatches).toHaveCount(4, { timeout: 10_000 });
		for (const area of ["users", "billing", "ai", "api"]) {
			const swatch = page
				.locator("section#foundations")
				.locator(`[data-testid='area-swatch'][data-area='${area}']`);
			await expect(swatch).toContainText(`area-${area}`);
			await expect(swatch).toContainText(`area-${area}-foreground`);
		}
	});

	test("mesh demo is tinted by area tokens", async ({ page }) => {
		await page.goto("/design");
		const demo = page.locator("section#patterns").getByTestId("mesh-area-demo");
		await expect(demo).toBeVisible({ timeout: 10_000 });
		await expect(demo).toContainText("var(--area-users)");
		await expect(demo).toContainText("var(--area-ai)");
	});

	test("do and don't covers area color and opacity on area text", async ({
		page,
	}) => {
		await page.goto("/design");
		const section = page.locator("section#do-dont");
		await expect(
			section.getByRole("heading", { name: /area color marks the area/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(
			section.getByRole("heading", { name: /no opacity on area text/i }),
		).toBeVisible();
	});

	test("header and sections use the PageHeader and Card primitives", async ({
		page,
	}) => {
		await page.goto("/design");
		const region = page.getByRole("region", { name: /^design system$/i });
		await expect(region.locator("[data-slot='page-header']")).toHaveCount(1, {
			timeout: 10_000,
		});
		// The intro block is one Card holding the "what" and the "how".
		await expect(region.locator("[data-slot='card']")).toHaveCount(1);
	});

	test("intro explains what the page is and how to change it", async ({
		page,
	}) => {
		await page.goto("/design");
		const intro = page
			.getByRole("region", { name: /^design system$/i })
			.locator("[data-slot='card']");
		await expect(
			intro.getByRole("heading", { level: 2, name: /what this page is/i }),
		).toBeVisible({ timeout: 10_000 });
		await expect(intro).toContainText("packages/config/brand.css");

		const how = intro.getByRole("heading", {
			level: 2,
			name: /how to change it/i,
		});
		await expect(how).toBeVisible();
		const steps = intro.getByRole("listitem");
		await expect(steps).toHaveCount(3);
		await expect(steps.nth(0)).toContainText("brand.css");
		await expect(steps.nth(1)).toContainText("tweakcn");
		await expect(steps.nth(1)).toContainText("ui.shadcn.com/create");
		await expect(steps.nth(2)).toContainText("setup-brand");
		await expect(intro).toContainText("DESIGN.md");
	});

	for (const width of [1280, 375]) {
		test(`section nav sticks while scrolling and marks the active section (${width}px)`, async ({
			page,
		}) => {
			await page.setViewportSize({ width, height: 800 });
			await page.goto("/design");
			const nav = page.getByRole("navigation", { name: /on this page/i });
			await expect(nav).toBeVisible({ timeout: 10_000 });
			await expect(nav.locator("[aria-current]")).toHaveCount(0);

			for (const id of ["patterns", "components", "foundations"]) {
				await nav.locator(`a[href='#${id}']`).click();
				await expect(nav.locator(`a[href='#${id}']`)).toHaveAttribute(
					"aria-current",
					"location",
				);
				await expect(nav.locator("[aria-current]")).toHaveCount(1);

				// Once the (smooth) jump settles, the section's top sits on its
				// scroll margin, the nav is pinned near the top of the viewport…
				const section = page.locator(`section#${id}`);
				await expect
					.poll(() =>
						section.evaluate(
							(el) =>
								Math.abs(
									el.getBoundingClientRect().top -
										Number.parseFloat(getComputedStyle(el).scrollMarginTop),
								) <= 2,
						),
					)
					.toBe(true);
				const navBox = await nav.boundingBox();
				expect(navBox?.y ?? -1).toBeGreaterThanOrEqual(0);
				expect(navBox?.y ?? 999).toBeLessThan(width < 768 ? 120 : 40);

				// …and the section heading lands below it, not under it.
				const headingBox = await section
					.getByRole("heading", { level: 2 })
					.boundingBox();
				expect(headingBox?.y ?? -1).toBeGreaterThanOrEqual(
					(navBox?.y ?? 0) + (navBox?.height ?? 0),
				);
			}
			expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
		});
	}

	test("section nav is a rounded floating pill", async ({ page }) => {
		await page.goto("/design");
		const pill = page
			.getByRole("navigation", { name: /on this page/i })
			.getByRole("list");
		await expect(pill).toBeVisible({ timeout: 10_000 });
		const style = await pill.evaluate((el) => {
			const cs = getComputedStyle(el);
			return {
				radius: Number.parseFloat(cs.borderTopLeftRadius),
				height: el.getBoundingClientRect().height,
				shadow: cs.boxShadow,
			};
		});
		expect(style.radius).toBeGreaterThanOrEqual(style.height / 2);
		expect(style.shadow).not.toBe("none");
	});

	test("section nav jumps without smooth scrolling under reduced motion", async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: "reduce" });
		await page.goto("/design");
		const nav = page.getByRole("navigation", { name: /on this page/i });
		await expect(nav).toBeVisible({ timeout: 10_000 });
		await nav.locator("a[href='#patterns']").click();
		// No animation frames to wait for: the target is already in place.
		const top = await page.evaluate(
			() => document.getElementById("patterns")?.getBoundingClientRect().top,
		);
		expect(top).toBeLessThan(200);
		expect(top).toBeGreaterThanOrEqual(0);
		await expect(page).toHaveURL(/#patterns$/);
	});

	test("dialog opens from its trigger and closes on Escape", async ({
		page,
	}) => {
		await page.goto("/design");
		await page
			.locator("section#components")
			.getByRole("button", { name: /^open dialog$/i })
			.click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(dialog).toBeHidden();
	});
});
