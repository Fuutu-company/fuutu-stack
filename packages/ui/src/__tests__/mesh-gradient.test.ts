import { describe, expect, it } from "vitest";
import { parseColorToVec3 } from "../lib/color";

const FALLBACK: [number, number, number] = [0.1, 0.2, 0.3];

describe("parseColorToVec3", () => {
	it("parses hex colors", () => {
		expect(parseColorToVec3("#7c3aed", FALLBACK)).toEqual([
			124 / 255,
			58 / 255,
			237 / 255,
		]);
		expect(parseColorToVec3("7c3aed", FALLBACK)).toEqual([
			124 / 255,
			58 / 255,
			237 / 255,
		]);
	});

	it("parses rgb() and rgba() in comma and space syntax", () => {
		const expected: [number, number, number] = [124 / 255, 58 / 255, 237 / 255];
		expect(parseColorToVec3("rgb(124, 58, 237)", FALLBACK)).toEqual(expected);
		expect(parseColorToVec3("rgb(124 58 237)", FALLBACK)).toEqual(expected);
		expect(parseColorToVec3("rgba(124, 58, 237, 0.5)", FALLBACK)).toEqual(
			expected,
		);
		expect(parseColorToVec3("rgb(124 58 237 / 0.5)", FALLBACK)).toEqual(
			expected,
		);
	});

	it("parses percentage rgb()", () => {
		expect(parseColorToVec3("rgb(50% 25% 90%)", FALLBACK)).toEqual([
			0.5, 0.25, 0.9,
		]);
	});

	it("parses color(srgb ...)", () => {
		expect(parseColorToVec3("color(srgb 0.5 0.25 0.9)", FALLBACK)).toEqual([
			0.5, 0.25, 0.9,
		]);
	});

	it("converts oklch() to sRGB", () => {
		// oklch(0.45 0.22 270) ≈ rgb(46, 58, 204) — the theme's light-mode --brand
		const [r, g, b] = parseColorToVec3("oklch(0.45 0.22 270)", FALLBACK);
		expect(r).toBeCloseTo(0.18, 1);
		expect(g).toBeCloseTo(0.23, 1);
		expect(b).toBeCloseTo(0.8, 1);
	});

	it("parses oklch() with an alpha channel", () => {
		const [r, g, b] = parseColorToVec3("oklch(0.45 0.22 270 / 0.5)", FALLBACK);
		expect(r).toBeCloseTo(0.18, 1);
		expect(g).toBeCloseTo(0.23, 1);
		expect(b).toBeCloseTo(0.8, 1);
	});

	it("produces equal channels for achromatic oklch", () => {
		const [r, g, b] = parseColorToVec3("oklch(0.7 0 0)", FALLBACK);
		expect(r).toBeCloseTo(g, 5);
		expect(g).toBeCloseTo(b, 5);
	});

	it("returns the fallback for unresolvable input", () => {
		expect(
			parseColorToVec3("oklch(from var(--brand) l c h / 1)", FALLBACK),
		).toEqual(FALLBACK);
		expect(parseColorToVec3("", FALLBACK)).toEqual(FALLBACK);
		expect(parseColorToVec3("var(--primary)", FALLBACK)).toEqual(FALLBACK);
		expect(parseColorToVec3("not-a-color", FALLBACK)).toEqual(FALLBACK);
	});
});
