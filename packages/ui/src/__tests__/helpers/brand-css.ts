import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	compositeOver,
	contrastRatio,
	type ParsedColor,
	parseColor,
	type Vec3,
} from "../../lib/color";
import type { ContrastPair } from "../../lib/contrast-pairs";

export type ThemeMode = "light" | "dark";
export type ThemeBlocks = Record<ThemeMode, Record<string, string>>;
export type PairResult =
	| { ratio: number; surface?: string }
	| { error: string };

const CONFIG_DIR = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../config",
);

/** Opaque canvas each mode's background sits on (browser default per color-scheme). */
const CANVAS: Record<ThemeMode, Vec3> = { light: [1, 1, 1], dark: [0, 0, 0] };

/** shadcn's dark destructive fill is `dark:bg-destructive/60`. */
const DARK_DESTRUCTIVE_FILL_ALPHA = 0.6;
/** Components draw focus as `ring-ring/50`. */
const FOCUS_RING_ALPHA = 0.5;
/** Default Button hover is `hover:bg-primary/90`. */
const PRIMARY_HOVER_FILL_ALPHA = 0.9;
const PRIMARY_BAND_TILE_ALPHA = 0.08;
/** Button/Badge destructive render `text-white`, whatever --destructive-foreground says. */
const WHITE: Vec3 = [1, 1, 1];
/** Surfaces a destructive button sits on (page, cards, dialogs/popovers). */
const FILL_SURFACES = ["background", "card", "popover"] as const;

export function readConfigCss(file: "brand.css" | "theme.css"): string {
	return readFileSync(resolve(CONFIG_DIR, file), "utf8");
}

/** Remove `/* … *\/` comments, leaving quoted strings (e.g. `@source` globs) intact. */
function stripComments(css: string): string {
	let out = "";
	let quote: string | null = null;
	for (let i = 0; i < css.length; i++) {
		const ch = css[i];
		if (quote) {
			if (ch === quote) quote = null;
			out += ch;
		} else if (ch === "/" && css[i + 1] === "*") {
			const end = css.indexOf("*/", i + 2);
			i = end === -1 ? css.length : end + 1;
		} else {
			if (ch === '"' || ch === "'") quote = ch;
			out += ch;
		}
	}
	return out;
}

type TopLevelRule = { prelude: string; body: string | null };

function splitTopLevel(css: string): TopLevelRule[] {
	const src = stripComments(css);
	const rules: TopLevelRule[] = [];
	let depth = 0;
	let quote: string | null = null;
	let start = 0;
	let bodyStart = -1;
	let prelude = "";

	for (let i = 0; i < src.length; i++) {
		const ch = src[i];
		if (quote) {
			if (ch === quote) quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") {
			quote = ch;
		} else if (ch === "{") {
			if (depth === 0) {
				prelude = src.slice(start, i).trim();
				bodyStart = i + 1;
			}
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0) {
				rules.push({ prelude, body: src.slice(bodyStart, i) });
				start = i + 1;
			}
		} else if (ch === ";" && depth === 0) {
			const statement = src.slice(start, i).trim();
			if (statement) rules.push({ prelude: statement, body: null });
			start = i + 1;
		}
	}
	return rules;
}

/** Preludes of the top-level rules and statements, e.g. `:root`, `@import "./brand.css"`. */
export function topLevelRules(css: string): string[] {
	return splitTopLevel(css).map((r) => r.prelude.replace(/\s+/g, " "));
}

function parseDeclarations(body: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const decl of body.split(";")) {
		const match = /^\s*--([\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(decl);
		if (match?.[1] && match[2]) out[match[1]] = match[2].replace(/\s+/g, " ");
	}
	return out;
}

/** Custom properties of the top-level `:root` (light) and `.dark` rules; everything else is ignored. */
export function parseThemeBlocks(css: string): ThemeBlocks {
	const blocks: ThemeBlocks = { light: {}, dark: {} };
	for (const { prelude, body } of splitTopLevel(css)) {
		if (body === null) continue;
		if (prelude === ":root")
			Object.assign(blocks.light, parseDeclarations(body));
		else if (prelude === ".dark")
			Object.assign(blocks.dark, parseDeclarations(body));
	}
	return blocks;
}

function lookup(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	name: string,
): string | undefined {
	return mode === "dark"
		? (blocks.dark[name] ?? blocks.light[name])
		: blocks.light[name];
}

/**
 * Resolve a token as the browser would on `<html class="dark">`: `.dark` wins,
 * `:root` fills gaps, `var(--x[, fallback])` is followed within the mode.
 * Returns undefined when the token is missing or the references cycle.
 */
export function resolveToken(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	name: string,
	seen: ReadonlySet<string> = new Set(),
): string | undefined {
	if (seen.has(name)) return undefined;
	const value = lookup(blocks, mode, name);
	if (value === undefined) return undefined;

	const ref = /^var\(\s*--([\w-]+)\s*(?:,\s*([\s\S]+))?\)$/.exec(value);
	if (!ref?.[1]) return value;
	const next = new Set(seen).add(name);
	return resolveToken(blocks, mode, ref[1], next) ?? ref[2]?.trim();
}

/** `[l, c, h]` of a literal `oklch()` value (percent lightness normalised), else null. */
export function parseOklch(value: string): [number, number, number] | null {
	const match = /^oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)/.exec(
		value.trim(),
	);
	if (!match?.[1] || !match[2] || !match[3]) return null;
	const l = Number.parseFloat(match[1]);
	return [
		match[1].endsWith("%") ? l / 100 : l,
		Number.parseFloat(match[2]),
		Number.parseFloat(match[3]),
	];
}

type Resolved = { ok: true; value: string } | { ok: false; error: string };

function resolveColor(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	name: string,
): Resolved {
	const raw = resolveToken(blocks, mode, name);
	if (raw === undefined) {
		return {
			ok: false,
			error: `${mode}: --${name} is missing or its var() references do not resolve`,
		};
	}
	return { ok: true, value: raw };
}

function parseToken(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	name: string,
): ParsedColor | { error: string } {
	const resolved = resolveColor(blocks, mode, name);
	if (!resolved.ok) return { error: resolved.error };
	return (
		parseColor(resolved.value) ?? {
			error: `${mode}: --${name} is not a parseable color: ${resolved.value}`,
		}
	);
}

function surface(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	name: string,
): { rgb: Vec3 } | { error: string } {
	const color = parseToken(blocks, mode, name);
	if ("error" in color) return color;
	if (color.alpha >= 1) return { rgb: color.rgb };

	const under =
		name === "background"
			? { rgb: CANVAS[mode] }
			: surface(blocks, mode, "background");
	if ("error" in under) return under;
	return { rgb: compositeOver(color, under.rgb) };
}

/**
 * Literal white on the destructive fill shadcn renders — solid in light,
 * `destructive/60` in dark — composited over every surface a destructive
 * button sits on. Returns the worst ratio and names that surface.
 */
function measureDestructiveFill(
	blocks: ThemeBlocks,
	mode: ThemeMode,
): PairResult {
	const destructive = parseToken(blocks, mode, "destructive");
	if ("error" in destructive) return destructive;
	const alpha =
		destructive.alpha * (mode === "dark" ? DARK_DESTRUCTIVE_FILL_ALPHA : 1);

	let worst: { ratio: number; surface: string } | undefined;
	for (const name of FILL_SURFACES) {
		const under = surface(blocks, mode, name);
		if ("error" in under) return under;
		const fill = compositeOver({ rgb: destructive.rgb, alpha }, under.rgb);
		const ratio = contrastRatio(WHITE, fill);
		if (!worst || ratio < worst.ratio) worst = { ratio, surface: name };
	}
	return worst ?? { error: `${mode}: no surface to measure the fill on` };
}

/**
 * The ring token at `ring-ring/50` composited over every surface a focused
 * control sits on. Returns the worst ratio and names that surface.
 */
function measureFocusRing(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	pair: ContrastPair,
): PairResult {
	const ring = parseToken(blocks, mode, pair.fg);
	if ("error" in ring) return ring;
	const alpha = ring.alpha * FOCUS_RING_ALPHA;

	let worst: { ratio: number; surface: string } | undefined;
	for (const name of FILL_SURFACES) {
		const under = surface(blocks, mode, name);
		if ("error" in under) return under;
		const outline = compositeOver({ rgb: ring.rgb, alpha }, under.rgb);
		const ratio = contrastRatio(outline, under.rgb);
		if (!worst || ratio < worst.ratio) worst = { ratio, surface: name };
	}
	return worst ?? { error: `${mode}: no surface to measure the ring on` };
}

/**
 * `primary-foreground` on `hover:bg-primary/90` composited over every surface
 * a button sits on (background, card, popover). Returns the worst ratio and
 * names that surface.
 */
function measurePrimaryHoverFill(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	pair: ContrastPair,
): PairResult {
	const primary = parseToken(blocks, mode, pair.bg);
	if ("error" in primary) return primary;
	const fg = parseToken(blocks, mode, pair.fg);
	if ("error" in fg) return fg;

	let worst: { ratio: number; surface: string } | undefined;
	for (const name of FILL_SURFACES) {
		const under = surface(blocks, mode, name);
		if ("error" in under) return under;
		const fill = compositeOver(
			{ rgb: primary.rgb, alpha: primary.alpha * PRIMARY_HOVER_FILL_ALPHA },
			under.rgb,
		);
		const ratio = contrastRatio(compositeOver(fg, fill), fill);
		if (!worst || ratio < worst.ratio) worst = { ratio, surface: name };
	}
	return worst ?? { error: `${mode}: no surface to measure the fill on` };
}

/**
 * `primary-foreground` on the SecurityBand tile: `bg-primary-foreground/[0.08]`
 * over the solid `bg-primary` band.
 */
function measurePrimaryBandTile(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	pair: ContrastPair,
): PairResult {
	const band = surface(blocks, mode, pair.bg);
	if ("error" in band) return band;
	const fg = parseToken(blocks, mode, pair.fg);
	if ("error" in fg) return fg;
	const tile = compositeOver(
		{ rgb: fg.rgb, alpha: fg.alpha * PRIMARY_BAND_TILE_ALPHA },
		band.rgb,
	);
	return { ratio: contrastRatio(compositeOver(fg, tile), tile) };
}

/**
 * Contrast of one pair in one mode. Alpha tokens are composited over the
 * pair's surface (which itself sits on `background`). The destructive fill
 * pair ignores `fg` and `--destructive-foreground`: see measureDestructiveFill.
 */
export function measurePair(
	blocks: ThemeBlocks,
	mode: ThemeMode,
	pair: ContrastPair,
): PairResult {
	if (pair.effective === "destructive-fill") {
		return measureDestructiveFill(blocks, mode);
	}
	if (pair.effective === "primary-hover-blend") {
		return measurePrimaryHoverFill(blocks, mode, pair);
	}
	if (pair.effective === "primary-band-tile") {
		return measurePrimaryBandTile(blocks, mode, pair);
	}
	if (pair.effective === "focus-ring") {
		return measureFocusRing(blocks, mode, pair);
	}
	const bg = surface(blocks, mode, pair.bg);
	if ("error" in bg) return bg;
	const fg = parseToken(blocks, mode, pair.fg);
	if ("error" in fg) return fg;
	return { ratio: contrastRatio(compositeOver(fg, bg.rgb), bg.rgb) };
}
