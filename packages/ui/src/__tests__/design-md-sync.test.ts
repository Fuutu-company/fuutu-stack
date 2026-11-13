import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseThemeBlocks, readConfigCss } from "./helpers/brand-css";
import {
	asMap,
	bodyHeadings,
	DESIGN_MD,
	parseYamlSubset,
	readDesignMd,
	sectionOf,
	splitFrontmatter,
	stringEntries,
	type YamlMap,
} from "./helpers/design-md";

const ALLOWED_KEYS = [
	"colors",
	"typography",
	"rounded",
	"spacing",
	"components",
];

const HEADINGS = [
	"Overview",
	"Colors",
	"Typography",
	"Layout",
	"Elevation & Depth",
	"Shapes",
	"Components",
	"Do's and Don'ts",
	"Motion",
	"Iconography",
	"Accessibility",
	"Decisions",
	"Iteration Guide",
	"Known Gaps",
];

const NON_COLOR_PREFIXES = [
	"radius",
	"font-",
	"shadow",
	"spacing",
	"letter-spacing",
	"tracking",
];

const isColorToken = (name: string) =>
	!NON_COLOR_PREFIXES.some((p) => name.startsWith(p));

function onlyColors(tokens: Record<string, string>): Record<string, string> {
	return Object.fromEntries(
		Object.entries(tokens).filter(([name]) => isColorToken(name)),
	);
}

const hasDesignMd = existsSync(DESIGN_MD);
/** DESIGN.md is optional: without it the suites below skip and these stay empty. */
const doc = hasDesignMd
	? splitFrontmatter(readDesignMd())
	: { front: "", body: "" };
const front: YamlMap = hasDesignMd ? parseYamlSubset(doc.front) : {};
const brand = parseThemeBlocks(readConfigCss("brand.css"));
const colors: YamlMap = hasDesignMd ? asMap(front.colors, "colors") : {};

describe.skipIf(!hasDesignMd)("DESIGN.md frontmatter", () => {
	it("has only the allowed top-level keys", () => {
		const extra = Object.keys(front).filter((k) => !ALLOWED_KEYS.includes(k));
		expect(extra).toEqual([]);
	});

	it("colors.light equals the brand.css :root color tokens", () => {
		expect(stringEntries(asMap(colors.light, "colors.light"))).toEqual(
			onlyColors(brand.light),
		);
	});

	it("colors.dark equals the brand.css .dark tokens", () => {
		expect(stringEntries(asMap(colors.dark, "colors.dark"))).toEqual(
			onlyColors(brand.dark),
		);
	});

	it("rounded.lg equals --radius", () => {
		const rounded = stringEntries(asMap(front.rounded, "rounded"));
		expect(rounded.lg).toBe(brand.light.radius);
	});
});

describe.skipIf(!hasDesignMd)("DESIGN.md body", () => {
	it("has the canonical sections in order", () => {
		expect(bodyHeadings(doc.body)).toEqual(HEADINGS);
	});

	it("Decisions table header is Decision | Rationale | Date", () => {
		const header = sectionOf(doc.body, "Decisions")
			.split("\n")
			.find((l) => l.trim().startsWith("|"));
		expect(header?.replace(/\s+/g, " ").trim()).toBe(
			"| Decision | Rationale | Date |",
		);
	});

	it("every oklch() in the body equals a frontmatter color value", () => {
		const known = new Set([
			...Object.values(stringEntries(asMap(colors.light, "colors.light"))),
			...Object.values(stringEntries(asMap(colors.dark, "colors.dark"))),
		]);
		const used = [...doc.body.matchAll(/oklch\([^)]*\)/g)].map((m) =>
			m[0].replace(/\s+/g, " "),
		);
		expect(used.length).toBeGreaterThan(0);
		expect(used.filter((v) => !known.has(v))).toEqual([]);
	});
});
