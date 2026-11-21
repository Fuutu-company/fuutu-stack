import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	brandIconColors,
	cssColorToHex,
	iconBackdropSvg,
	oklchToHex,
} from "../../../../tooling/scripts/lib/app-icon.mjs";

const ROOT = join(import.meta.dirname, "../../../..");

describe("app icon (logo on the brand backdrop, pnpm assets:sync)", () => {
	it("converts OKLCH to sRGB hex", () => {
		expect(oklchToHex(1, 0, 0)).toBe("#ffffff");
		expect(oklchToHex(0, 0, 0)).toBe("#000000");
		// oklch(0.628 0.2577 29.23) is CSS red.
		expect(oklchToHex(0.628, 0.2577, 29.23)).toBe("#ff0000");
	});

	it("reads oklch() (with % or alpha) and hex values", () => {
		expect(cssColorToHex("oklch(100% 0 0)")).toBe("#ffffff");
		expect(cssColorToHex("oklch(0 0 0 / 50%)")).toBe("#000000");
		expect(cssColorToHex("#ABC")).toBe("#aabbcc");
		expect(() => cssColorToHex("rgb(1 2 3)")).toThrow(/unsupported color/);
	});

	it("takes the LIGHT palette from :root, never .dark", () => {
		const css = `:root { --background: #ffffff; }
.dark { --background: #000000; --area-users: #000000; }
:root { --area-users: #112233; --area-billing: #445566; }`;
		expect(brandIconColors(css)).toEqual({
			background: "#ffffff",
			areaUsers: "#112233",
			areaBilling: "#445566",
		});
		expect(() => brandIconColors(":root { --background: #fff; }")).toThrow(
			/--area-users missing/,
		);
	});

	it("this repo's brand.css yields the colors (whatever they are)", () => {
		const colors = brandIconColors(
			readFileSync(join(ROOT, "packages/config/brand.css"), "utf8"),
		);
		for (const value of Object.values(colors)) {
			expect(value).toMatch(/^#[0-9a-f]{6}$/);
		}
	});

	it("draws the two area blobs over the background, clipped to the rounded body", () => {
		const svg = iconBackdropSvg({
			background: "#eeeeee",
			areaUsers: "#0000ff",
			areaBilling: "#00ff00",
		});
		expect(svg).toContain('fill="#eeeeee"');
		expect(svg).toContain('stop-color="#0000ff"');
		expect(svg).toContain('stop-color="#00ff00"');
		expect(svg).toContain('clip-path="url(#body)"');
	});
});
