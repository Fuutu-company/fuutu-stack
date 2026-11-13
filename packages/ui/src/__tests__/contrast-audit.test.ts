import { describe, expect, it } from "vitest";
import { isInSrgbGamut } from "../lib/color";
import { CONTRAST_PAIRS, type ContrastPair } from "../lib/contrast-pairs";
import {
	measurePair,
	parseOklch,
	parseThemeBlocks,
	readConfigCss,
	resolveToken,
	type ThemeBlocks,
	type ThemeMode,
	topLevelRules,
} from "./helpers/brand-css";

const MODES: readonly ThemeMode[] = ["light", "dark"];
let cached: ThemeBlocks | undefined;
function brandBlocks(): ThemeBlocks {
	cached ??= parseThemeBlocks(readConfigCss("brand.css"));
	return cached;
}

function ratioOf(css: string, mode: ThemeMode, pair: ContrastPair): number {
	const result = measurePair(parseThemeBlocks(css), mode, pair);
	if ("error" in result) throw new Error(result.error);
	return result.ratio;
}

describe("CONTRAST_PAIRS", () => {
	it("includes the text-use pairs on background and card", () => {
		const keys = new Set(
			CONTRAST_PAIRS.filter((p) => p.min === 4.5).map((p) => `${p.fg}/${p.bg}`),
		);
		for (const fg of [
			"muted-foreground",
			"primary",
			"destructive",
			"success",
		]) {
			expect(keys).toContain(`${fg}/background`);
			expect(keys).toContain(`${fg}/card`);
		}
	});

	it("includes the three area pairs per area", () => {
		const keys = new Set(
			CONTRAST_PAIRS.filter((p) => p.min === 4.5 && !p.effective).map(
				(p) => `${p.fg}/${p.bg}`,
			),
		);
		for (const area of ["users", "billing", "ai", "api"]) {
			const fg = `area-${area}-foreground`;
			expect(keys).toContain(`${fg}/area-${area}`);
			expect(keys).toContain(`${fg}/background`);
			expect(keys).toContain(`${fg}/card`);
		}
	});

	it("checks the focus ring at 3:1", () => {
		expect(
			CONTRAST_PAIRS.some(
				(p) =>
					p.effective === "focus-ring" &&
					p.fg === "ring" &&
					p.bg === "background" &&
					p.min === 3,
			),
		).toBe(true);
	});

	it("checks the effective destructive fill", () => {
		expect(CONTRAST_PAIRS.some((p) => p.effective === "destructive-fill")).toBe(
			true,
		);
	});
});

describe("brand.css contrast audit", () => {
	const cases = MODES.flatMap((mode) =>
		CONTRAST_PAIRS.map((pair) => ({ mode, pair })),
	);

	it.each(cases)(
		"$mode: $pair.fg on $pair.bg ≥ $pair.min:1",
		({ mode, pair }) => {
			const result = measurePair(brandBlocks(), mode, pair);
			if ("error" in result) expect.fail(result.error);
			const over = result.surface ? ` over ${result.surface}` : "";
			expect(
				result.ratio,
				`${mode}: ${pair.fg} on ${pair.bg}${over} measured ${result.ratio.toFixed(2)}:1`,
			).toBeGreaterThanOrEqual(pair.min);
		},
	);

	it("chart-1…5 are in sRGB gamut (both modes)", () => {
		for (const mode of MODES) {
			for (const n of [1, 2, 3, 4, 5]) {
				const value = resolveToken(brandBlocks(), mode, `chart-${n}`) ?? "";
				const lch = parseOklch(value);
				if (!lch) continue;
				expect(isInSrgbGamut(...lch), `${mode}: chart-${n} ${value}`).toBe(
					true,
				);
			}
		}
	});

	it("area tokens are in sRGB gamut (both modes)", () => {
		for (const mode of MODES) {
			for (const area of ["users", "billing", "ai", "api"]) {
				for (const name of [`area-${area}`, `area-${area}-foreground`]) {
					const value = resolveToken(brandBlocks(), mode, name);
					expect(value, `${mode}: --${name} defined`).toBeDefined();
					const lch = parseOklch(value ?? "");
					if (!lch) continue;
					expect(isInSrgbGamut(...lch), `${mode}: ${name} ${value}`).toBe(true);
				}
			}
		}
	});
});

describe("audit mechanics (fixtures)", () => {
	it("composites alpha tokens over their surface", () => {
		const fgAlpha = ":root { --card: #ffffff; --input: oklch(0 0 0 / 50%); }";
		expect(
			ratioOf(fgAlpha, "light", { fg: "input", bg: "card", min: 3 }),
		).toBeCloseTo(3.977, 2);

		const bgAlpha =
			":root { --background: #000000; --muted: oklch(1 0 0 / 50%); --muted-foreground: #ffffff; }";
		expect(
			ratioOf(bgAlpha, "light", {
				fg: "muted-foreground",
				bg: "muted",
				min: 4.5,
			}),
		).toBeCloseTo(3.977, 2);

		const shadcnDark =
			".dark { --background: oklch(0.145 0 0); --card: oklch(0.205 0 0); --input: oklch(1 0 0 / 15%); }";
		expect(
			ratioOf(shadcnDark, "dark", { fg: "input", bg: "card", min: 3 }),
		).toBeLessThan(3);
	});

	it("resolves var() references and falls back to :root", () => {
		const css = `
			:root { --background: #ffffff; --foreground: #000000; --primary: var(--foreground); --ring: var(--missing, #ff0000); }
			.dark { --background: #000000; --foreground: #ffffff; }
		`;
		const b = parseThemeBlocks(css);
		expect(resolveToken(b, "light", "primary")).toBe("#000000");
		expect(resolveToken(b, "dark", "primary")).toBe("#ffffff");
		expect(resolveToken(b, "dark", "background")).toBe("#000000");
		expect(resolveToken(b, "light", "ring")).toBe("#ff0000");
		expect(resolveToken(b, "light", "nope")).toBeUndefined();
	});

	it("ignores other at-rules and comments when reading blocks", () => {
		const css = `
			/* :root { --background: #123456; } */
			@theme inline { --color-background: var(--background); }
			@media (min-width: 1px) { :root { --background: #abcdef; } }
			:root { --background: #ffffff; }
		`;
		const b = parseThemeBlocks(css);
		expect(b.light).toEqual({ background: "#ffffff" });
		expect(b.dark).toEqual({});
		expect(
			topLevelRules('@source "../ui/src/**/*.{ts,tsx}"; /* x */ :root { }'),
		).toEqual(['@source "../ui/src/**/*.{ts,tsx}"', ":root"]);
	});

	it("fails naming token and mode instead of passing", () => {
		const pair: ContrastPair = {
			fg: "primary-foreground",
			bg: "primary",
			min: 4.5,
		};
		const cases = [
			".dark { --primary: color-mix(in oklch, red 50%, blue); --primary-foreground: #fff; }",
			".dark { --primary: rebeccapurple; --primary-foreground: #fff; }",
			".dark { --primary: oklch(from var(--x) l c h); --primary-foreground: #fff; }",
			".dark { --primary: var(--primary-foreground); --primary-foreground: var(--primary); }",
			".dark { --primary-foreground: #fff; }",
		];
		for (const css of cases) {
			const result = measurePair(parseThemeBlocks(css), "dark", pair);
			expect(result, css).toHaveProperty("error");
			if ("error" in result) {
				expect(result.error).toContain("dark");
				expect(result.error).toContain("--primary");
			}
		}
	});

	it("accepts hsl() tokens", () => {
		const css =
			".dark { --primary: hsl(0 0% 0%); --primary-foreground: hsl(0 0% 100%); }";
		const pair: ContrastPair = {
			fg: "primary-foreground",
			bg: "primary",
			min: 4.5,
		};
		expect(ratioOf(css, "dark", pair)).toBeCloseTo(21, 2);
	});

	describe("primary hover fill", () => {
		const hover: ContrastPair = {
			fg: "primary-foreground",
			bg: "primary",
			min: 4.5,
			effective: "primary-hover-blend",
		};

		it("is part of CONTRAST_PAIRS at 4.5", () => {
			expect(
				CONTRAST_PAIRS.some(
					(p) => p.effective === "primary-hover-blend" && p.min === 4.5,
				),
			).toBe(true);
		});

		it("measures primary/90 over background (light and dark)", () => {
			const css =
				":root { --background: #ffffff; --primary: #000000; --primary-foreground: #ffffff; } .dark { --background: #000000; --primary: #ffffff; --primary-foreground: #000000; }";
			// light: 90% black over white = #1a1a1a, white text
			expect(ratioOf(css, "light", hover)).toBeCloseTo(17.49, 1);
			// dark: 90% white over black = #e6e6e6, black text
			expect(ratioOf(css, "dark", hover)).toBeCloseTo(16.7, 1);
		});

		it("is weaker than the solid pair when the fill blends toward the page", () => {
			const css =
				":root { --background: #ffffff; --primary: #767676; --primary-foreground: #ffffff; }";
			const solid = ratioOf(css, "light", { ...hover, effective: undefined });
			expect(ratioOf(css, "light", hover)).toBeLessThan(solid);
		});
	});

	describe("focus ring", () => {
		const focus: ContrastPair = {
			fg: "ring",
			bg: "background",
			min: 3,
			effective: "focus-ring",
		};
		const surfaces = (bg: string, card: string, popover: string) =>
			`--background: ${bg}; --card: ${card}; --popover: ${popover};`;

		it("focus-ring measures ring at 50%: #000 ring on #fff ≈ 3.98", () => {
			const css = `:root { ${surfaces("#ffffff", "#ffffff", "#ffffff")} --ring: #000000; }`;
			expect(ratioOf(css, "light", focus)).toBeCloseTo(3.977, 2);
		});

		it("takes the worst of background, card and popover and names it", () => {
			const css = `:root { ${surfaces("#ffffff", "#000000", "#ffffff")} --ring: #000000; }`;
			const result = measurePair(parseThemeBlocks(css), "light", focus);
			expect(result).toEqual({ ratio: expect.closeTo(1, 2), surface: "card" });
		});
	});

	describe("destructive fill", () => {
		const fill: ContrastPair = {
			fg: "white",
			bg: "destructive",
			min: 4.5,
			effective: "destructive-fill",
		};
		const surfaces = (bg: string, card: string, popover: string) =>
			`--background: ${bg}; --card: ${card}; --popover: ${popover};`;

		it("measures literal white on the solid fill in light and the 60% fill in dark", () => {
			const css = `:root { ${surfaces("#ffffff", "#ffffff", "#ffffff")} --destructive: #000000; } .dark { ${surfaces("#000000", "#000000", "#000000")} --destructive: #ffffff; }`;
			expect(ratioOf(css, "light", fill)).toBeCloseTo(21, 2);
			expect(ratioOf(css, "dark", fill)).toBeCloseTo(2.849, 2);
		});

		it("ignores --destructive-foreground (Button/Badge render text-white)", () => {
			const css = `:root { ${surfaces("#ffffff", "#ffffff", "#ffffff")} --destructive: #000000; --destructive-foreground: #000000; }`;
			expect(ratioOf(css, "light", fill)).toBeCloseTo(21, 2);
			expect(
				ratioOf(css, "light", { ...fill, fg: "destructive-foreground" }),
			).toBeCloseTo(21, 2);
		});

		it("takes the worst of background, card and popover in dark and names it", () => {
			const css = `.dark { ${surfaces("#000000", "#ffffff", "#000000")} --destructive: #ffffff; }`;
			const result = measurePair(parseThemeBlocks(css), "dark", fill);
			expect(result).toEqual({ ratio: expect.closeTo(1, 2), surface: "card" });
		});

		it("fails naming a missing surface", () => {
			const css =
				".dark { --background: #000000; --popover: #000000; --destructive: #ffffff; }";
			const result = measurePair(parseThemeBlocks(css), "dark", fill);
			expect(result).toHaveProperty("error");
			if ("error" in result) expect(result.error).toContain("dark: --card");
		});
	});
});
