import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseColor, type Vec3 } from "../lib/color";
import {
	parseThemeBlocks,
	readConfigCss,
	resolveToken,
} from "./helpers/brand-css";

/**
 * Emails cannot read CSS variables or oklch, so `MAIL_COLORS`
 * (packages/mail/src/templates/colors.ts) holds the light brand tokens as hex.
 * Read as text: packages/ui does not depend on packages/mail.
 */

const MAIL_COLORS_TS = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../mail/src/templates/colors.ts",
);

/** MAIL_COLORS key → light brand.css token. */
const MAIL_TOKEN = {
	page: "background",
	card: "card",
	border: "border",
	text: "foreground",
	muted: "muted-foreground",
	button: "primary",
	buttonText: "primary-foreground",
} as const;

type MailKey = keyof typeof MAIL_TOKEN;

/** Largest per-channel difference (0–255) still counted as the same color. */
const CHANNEL_TOLERANCE = 2;

const toBytes = (rgb: Vec3) => rgb.map((c) => Math.round(c * 255));
const toHex = (rgb: Vec3) =>
	`#${toBytes(rgb)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}`;

/** `key: "#rrggbb"` pairs of the `MAIL_COLORS` object literal. */
function parseMailColors(colorsTs: string): Record<string, string> {
	const body = /MAIL_COLORS\s*=\s*\{([^}]*)\}/.exec(colorsTs)?.[1] ?? "";
	return Object.fromEntries(
		[...body.matchAll(/(\w+):\s*["']([^"']+)["']/g)].map(([, k, v]) => [k, v]),
	);
}

/** One line per MAIL_COLORS key whose hex is not its light token. */
function mailPaletteProblems(colorsTs: string, brandCss: string): string[] {
	const mail = parseMailColors(colorsTs);
	const blocks = parseThemeBlocks(brandCss);
	const problems: string[] = [];
	for (const [key, token] of Object.entries(MAIL_TOKEN)) {
		const value = mail[key];
		const mailColor = value ? parseColor(value) : null;
		if (!mailColor) {
			problems.push(`${key}: MAIL_COLORS.${key} is missing or not a color`);
			continue;
		}
		const raw = resolveToken(blocks, "light", token);
		const tokenColor = raw ? parseColor(raw) : null;
		if (!tokenColor) {
			problems.push(`${key}: brand.css --${token} is missing or not a color`);
			continue;
		}
		const want = toBytes(tokenColor.rgb);
		const off = toBytes(mailColor.rgb).some(
			(b, i) => Math.abs(b - (want[i] ?? 0)) > CHANNEL_TOLERANCE,
		);
		if (off) {
			problems.push(
				`${key}: MAIL_COLORS.${key} is ${value}, brand.css --${token} (${raw}) is ${toHex(tokenColor.rgb)}`,
			);
		}
	}
	return problems;
}

const brandCss = readConfigCss("brand.css");
const colorsTs = readFileSync(MAIL_COLORS_TS, "utf8");

describe("MAIL_COLORS follows brand.css", () => {
	it("every MAIL_COLORS value is the sRGB hex of its light token (±2 per channel)", () => {
		expect(mailPaletteProblems(colorsTs, brandCss)).toEqual([]);
	});

	it("fails naming the key when a token moves", () => {
		const moved = brandCss.replace(
			/(:root\s*\{[\s\S]*?--primary:\s*)[^;]+;/,
			"$1oklch(0.55 0.2 145);",
		);
		expect(moved).not.toBe(brandCss);
		const problems = mailPaletteProblems(colorsTs, moved);
		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatch(/^button: /);
	});
});

describe("MAIL_COLORS contrast", () => {
	const hex = (key: MailKey): Vec3 => {
		const value = new RegExp(`\\b${key}:\\s*"(#[0-9a-fA-F]{6})"`).exec(
			colorsTs,
		)?.[1];
		const parsed = value ? parseColor(value) : null;
		if (!parsed) throw new Error(`MAIL_COLORS.${key} is not a #rrggbb value`);
		return parsed.rgb;
	};

	it.each([
		["text", "card"],
		["muted", "card"],
		["buttonText", "button"],
	] as const)("%s on %s ≥ 4.5", (fg, bg) => {
		expect(contrastRatio(hex(fg), hex(bg))).toBeGreaterThanOrEqual(4.5);
	});
});
