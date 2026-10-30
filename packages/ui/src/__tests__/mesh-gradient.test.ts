import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	MeshGradient,
	supportsWebGL2Context,
	withCssFallback,
} from "../components/mesh-gradient";
import { parseColorToVec3 } from "../lib/color";

afterEach(() => {
	vi.unstubAllGlobals();
});

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

describe("supportsWebGL2Context", () => {
	it("rejects a missing context", () => {
		expect(supportsWebGL2Context(null)).toBe(false);
		expect(supportsWebGL2Context(undefined)).toBe(false);
		expect(supportsWebGL2Context({})).toBe(false);
	});

	it("rejects a non-WebGL2 context and accepts a WebGL2 instance", () => {
		class FakeWebGL2 {}
		vi.stubGlobal("WebGL2RenderingContext", FakeWebGL2);
		expect(supportsWebGL2Context(new FakeWebGL2())).toBe(true);
		expect(supportsWebGL2Context(Object.create(null))).toBe(false);
	});
});

describe("withCssFallback", () => {
	it("adds an sRGB fallback to bare var() colors", () => {
		expect(
			withCssFallback("var(--primary)", [124 / 255, 58 / 255, 237 / 255]),
		).toBe("var(--primary, rgb(124, 58, 237))");
	});

	it("passes through concrete colors and var() with existing fallback", () => {
		const fallback: [number, number, number] = [0.1, 0.2, 0.3];
		expect(withCssFallback("#ff0000", fallback)).toBe("#ff0000");
		expect(withCssFallback("oklch(0.7 0.2 30)", fallback)).toBe(
			"oklch(0.7 0.2 30)",
		);
		expect(withCssFallback("var(--x, red)", fallback)).toBe("var(--x, red)");
	});
});

describe("MeshGradient", () => {
	it("renders its container without WebGL (SSR-safe)", () => {
		const html = renderToString(createElement(MeshGradient));
		expect(html).toContain("aria-hidden");
	});

	it("merges a caller style prop after the internal style (caller wins)", () => {
		const html = renderToString(
			createElement(MeshGradient, {
				style: { opacity: 0.5, position: "fixed" },
			}),
		);
		expect(html).toContain("opacity:0.5");
		expect(html).toContain("position:fixed");
	});
});
