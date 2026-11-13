import { describe, expect, it } from "vitest";
import {
	compositeOver,
	contrastRatio,
	isInSrgbGamut,
	parseColor,
	relativeLuminance,
	WCAG_AA,
} from "../lib/color";

function rgbOf(input: string) {
	const parsed = parseColor(input);
	if (!parsed) throw new Error(`unparseable: ${input}`);
	return parsed.rgb;
}

describe("contrastRatio", () => {
	it("white vs black is 21:1", () => {
		expect(contrastRatio([1, 1, 1], [0, 0, 0])).toBeCloseTo(21, 5);
	});

	it("identical colors are 1:1", () => {
		expect(contrastRatio(rgbOf("#336699"), rgbOf("#336699"))).toBeCloseTo(1, 5);
	});

	it("#767676 on white ≥ 4.5 and #777777 < 4.5", () => {
		const white = rgbOf("#ffffff");
		expect(contrastRatio(rgbOf("#767676"), white)).toBeGreaterThanOrEqual(
			WCAG_AA.text,
		);
		expect(contrastRatio(rgbOf("#777777"), white)).toBeLessThan(WCAG_AA.text);
	});

	it("oklch(0.47 0.2 270) vs oklch(0.985 0.005 270) ≈ 6.97 (±0.02)", () => {
		const ratio = contrastRatio(
			rgbOf("oklch(0.47 0.2 270)"),
			rgbOf("oklch(0.985 0.005 270)"),
		);
		expect(Math.abs(ratio - 6.97)).toBeLessThanOrEqual(0.02);
	});

	it("is symmetric and exposes WCAG thresholds", () => {
		expect(contrastRatio([0, 0, 0], [1, 1, 1])).toBeCloseTo(21, 5);
		expect(relativeLuminance([1, 1, 1])).toBeCloseTo(1, 5);
		expect(WCAG_AA).toEqual({ text: 4.5, ui: 3 });
	});
});

describe("isInSrgbGamut", () => {
	it("oklch(0.95 0.025 270) is out of sRGB gamut, oklch(0.95 0.02 270) is in", () => {
		expect(isInSrgbGamut(0.95, 0.025, 270)).toBe(false);
		expect(isInSrgbGamut(0.95, 0.02, 270)).toBe(true);
	});
});

describe("parseColor", () => {
	it("parses alpha: `oklch(1 0 0 / 10%)` → alpha 0.1, `#0000ff80` → 0.5", () => {
		expect(parseColor("oklch(1 0 0 / 10%)")?.alpha).toBeCloseTo(0.1, 5);
		expect(parseColor("#0000ff80")?.alpha).toBeCloseTo(0.5, 2);
		expect(parseColor("rgba(0, 0, 0, 0.25)")?.alpha).toBeCloseTo(0.25, 5);
		expect(parseColor("#fff")?.rgb).toEqual([1, 1, 1]);
		expect(parseColor("#fff")?.alpha).toBe(1);
	});

	it("parses percent lightness `oklch(50% 0.1 200)`", () => {
		expect(rgbOf("oklch(50% 0.1 200)")).toEqual(rgbOf("oklch(0.5 0.1 200)"));
	});

	it("parses color(srgb) and rgb()", () => {
		expect(parseColor("color(srgb 0.2 0.4 0.6)")?.rgb).toEqual([0.2, 0.4, 0.6]);
		expect(parseColor("rgb(255 0 0)")?.rgb).toEqual([1, 0, 0]);
	});

	it("parses hsl()/hsla() in space and comma syntax with optional alpha", () => {
		expect(parseColor("hsl(0 100% 50%)")?.rgb).toEqual([1, 0, 0]);
		expect(parseColor("hsl(120, 100%, 25%)")?.rgb).toEqual([0, 0.5, 0]);
		expect(parseColor("hsl(240deg 100% 50%)")?.rgb).toEqual([0, 0, 1]);
		expect(parseColor("hsl(0 0% 100%)")?.rgb).toEqual([1, 1, 1]);
		const hsla = parseColor("hsla(0, 0%, 0%, 0.25)");
		expect(hsla?.rgb).toEqual([0, 0, 0]);
		expect(hsla?.alpha).toBeCloseTo(0.25, 5);
		expect(parseColor("hsl(210 50% 50% / 40%)")?.alpha).toBeCloseTo(0.4, 5);
		const c = parseColor("hsl(200 50% 50%)")?.rgb;
		expect(c?.[0]).toBeCloseTo(0.25, 5);
		expect(c?.[1]).toBeCloseTo(0.5833, 3);
		expect(c?.[2]).toBeCloseTo(0.75, 5);
	});

	it("wraps negative and >360 hues", () => {
		expect(parseColor("hsl(-120 100% 50%)")?.rgb).toEqual([0, 0, 1]);
		expect(parseColor("hsl(480 100% 50%)")?.rgb).toEqual(
			parseColor("hsl(120 100% 50%)")?.rgb,
		);
	});

	it("returns null for names, `color-mix()` and `oklch(from …)`", () => {
		expect(parseColor("color-mix(in oklch, red 50%, blue)")).toBeNull();
		expect(parseColor("rebeccapurple")).toBeNull();
		expect(parseColor("oklch(from var(--primary) l c h)")).toBeNull();
	});
});

describe("compositeOver", () => {
	it("compositeOver(black @ 0.5, white) = [0.5, 0.5, 0.5]", () => {
		const out = compositeOver({ rgb: [0, 0, 0], alpha: 0.5 }, [1, 1, 1]);
		expect(out[0]).toBeCloseTo(0.5, 5);
		expect(out[1]).toBeCloseTo(0.5, 5);
		expect(out[2]).toBeCloseTo(0.5, 5);
	});
});
