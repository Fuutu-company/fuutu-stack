import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type FontRole = "heading" | "sans" | "mono";

const read = (relative: string): string =>
	readFileSync(resolve(__dirname, relative), "utf8");

/**
 * Family the brand assigns to a font role, derived from the source of truth:
 * `--font-<role>` in brand.css names a `next/font` variable, and `fonts.ts`
 * binds that variable to a Google font constructor (`Schibsted_Grotesk`).
 * Returns a case-insensitive pattern that matches the computed family
 * (`__Schibsted_Grotesk_abc123` or `Schibsted Grotesk`).
 */
export function expectedFontFamily(role: FontRole): RegExp {
	const brand = read("../../../packages/config/brand.css");
	const declaration = new RegExp(`--font-${role}:\\s*var\\((--[\\w-]+)`).exec(
		brand,
	);
	const variable = declaration?.[1];
	if (!variable) throw new Error(`brand.css has no --font-${role} var()`);

	const fonts = read("../src/app/fonts.ts");
	const binding = new RegExp(
		`(\\w+)\\(\\{[^}]*variable:\\s*"${variable}"`,
	).exec(fonts);
	const name = binding?.[1];
	if (!name) throw new Error(`fonts.ts binds no font to ${variable}`);

	return new RegExp(name.split("_").join("[_ ]"), "i");
}
