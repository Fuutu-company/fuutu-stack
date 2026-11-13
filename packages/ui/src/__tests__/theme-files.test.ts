import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	parseThemeBlocks,
	readConfigCss,
	topLevelRules,
} from "./helpers/brand-css";

const SHADCN_COLOR_TOKENS = [
	"background",
	"foreground",
	"card",
	"card-foreground",
	"popover",
	"popover-foreground",
	"primary",
	"primary-foreground",
	"secondary",
	"secondary-foreground",
	"muted",
	"muted-foreground",
	"accent",
	"accent-foreground",
	"destructive",
	"border",
	"input",
	"ring",
	"chart-1",
	"chart-2",
	"chart-3",
	"chart-4",
	"chart-5",
	"sidebar",
	"sidebar-foreground",
	"sidebar-primary",
	"sidebar-primary-foreground",
	"sidebar-accent",
	"sidebar-accent-foreground",
	"sidebar-border",
	"sidebar-ring",
];

const KIT_STATUS_TOKENS = [
	"success",
	"success-foreground",
	"warning",
	"warning-foreground",
	"info",
	"info-foreground",
];

const AREAS = ["users", "billing", "ai", "api"] as const;
const KIT_AREA_TOKENS = AREAS.flatMap((a) => [
	`area-${a}`,
	`area-${a}-foreground`,
]);
const SHADOW_TOKENS = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"].map(
	(s) => `shadow-${s}`,
);

const NON_COLOR_PREFIXES = [
	"radius",
	"font-",
	"shadow",
	"spacing",
	"letter-spacing",
	"tracking",
];

function isColorToken(name: string): boolean {
	return !NON_COLOR_PREFIXES.some((p) => name.startsWith(p));
}

const brandCss = () => readConfigCss("brand.css");
const themeCss = () => readConfigCss("theme.css");
const blocks = () => parseThemeBlocks(brandCss());

describe("brand.css", () => {
	it("has only :root, .dark (and optional @theme inline) rules", () => {
		const allowed = new Set([":root", ".dark", "@theme inline"]);
		const unexpected = topLevelRules(brandCss()).filter((r) => !allowed.has(r));
		expect(unexpected).toEqual([]);
	});

	it("defines every shadcn token in both modes", () => {
		for (const mode of ["light", "dark"] as const) {
			const missing = SHADCN_COLOR_TOKENS.filter((t) => !(t in blocks()[mode]));
			expect(missing, `${mode}: missing tokens`).toEqual([]);
		}
		const rootOnly = ["radius", "font-sans", "font-mono", "font-heading"];
		expect(rootOnly.filter((t) => !(t in blocks().light))).toEqual([]);
	});

	it("defines kit status tokens success/warning/info (+ -foreground) in both modes", () => {
		for (const mode of ["light", "dark"] as const) {
			const missing = KIT_STATUS_TOKENS.filter((t) => !(t in blocks()[mode]));
			expect(missing, `${mode}: missing status tokens`).toEqual([]);
		}
	});

	it("defines kit area tokens (+ -foreground) in both modes", () => {
		for (const mode of ["light", "dark"] as const) {
			const missing = KIT_AREA_TOKENS.filter((t) => !(t in blocks()[mode]));
			expect(missing, `${mode}: missing area tokens`).toEqual([]);
		}
	});

	it("defines --shadow-2xs…2xl in both modes", () => {
		for (const mode of ["light", "dark"] as const) {
			const missing = SHADOW_TOKENS.filter((t) => !(t in blocks()[mode]));
			expect(missing, `${mode}: missing shadow tokens`).toEqual([]);
		}
	});
});

describe("theme.css", () => {
	it('first rule is @import "./brand.css"', () => {
		expect(topLevelRules(themeCss())[0]).toBe('@import "./brand.css"');
	});

	it("maps every brand.css color token as --color-<t>: var(--<t>)", () => {
		const { light, dark } = blocks();
		const css = themeCss();
		const names = new Set([...Object.keys(light), ...Object.keys(dark)]);
		const unmapped = [...names]
			.filter(isColorToken)
			.filter(
				(t) => !new RegExp(`--color-${t}:\\s*var\\(--${t}[,)]`).test(css),
			);
		expect(unmapped).toEqual([]);
	});

	it("maps --radius-2xl/3xl/4xl as calc(var(--radius) + 8px/12px/16px)", () => {
		const css = themeCss();
		for (const [step, px] of [
			["2xl", 8],
			["3xl", 12],
			["4xl", 16],
		] as const) {
			expect(css, `--radius-${step}`).toMatch(
				new RegExp(
					`--radius-${step}:\\s*calc\\(var\\(--radius\\) \\+ ${px}px\\);`,
				),
			);
		}
	});

	it("theme.css maps --tracking-heading and --tracking-display", () => {
		const css = themeCss();
		for (const t of ["tracking-heading", "tracking-display"]) {
			expect(css, `--${t}`).toMatch(
				new RegExp(`--${t}:\\s*var\\(--${t},\\s*-?[\\d.]+em\\)`),
			);
		}
	});
});

describe("theme files", () => {
	it.each([
		["brand.css", brandCss],
		["theme.css", themeCss],
	])(
		"%s has no --brand, --neutral, --primary-hover or oklch(from",
		(_, read) => {
			const banned = read().match(
				/--brand\b|--neutral\b|--primary-hover|oklch\(from/g,
			);
			expect(banned).toBeNull();
		},
	);
});

describe("components.json", () => {
	const uiDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
	const components = JSON.parse(
		readFileSync(resolve(uiDir, "components.json"), "utf8"),
	) as { tailwind: { config: string; css: string } };

	it('has tailwind.config "" (Tailwind v4)', () => {
		expect(components.tailwind.config).toBe("");
	});

	it("points tailwind.css at the existing brand.css", () => {
		const target = resolve(uiDir, components.tailwind.css);
		expect(target.endsWith("packages/config/brand.css")).toBe(true);
		expect(existsSync(target)).toBe(true);
	});
});
