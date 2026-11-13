import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: every app loads the same fonts the same way.
 *
 * - `apps/<app>/src/app/fonts.ts` loads Manrope (sans), Schibsted Grotesk
 *   (heading) and Geist Mono (mono) via `next/font/google` and exports
 *   `fontVariables`; the files are identical across apps.
 * - Each root layout applies `fontVariables` on `<html>`.
 * - The CSS variable names match the `var()` the brand.css font stacks read,
 *   otherwise the stacks silently fall back to system fonts.
 * - The `geist` package is not used for fonts anymore.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const APPS = ["saas", "marketing", "docs"] as const;
const BRAND_CSS = join(REPO_ROOT, "packages/config/brand.css");

const FONTS = [
	{ fn: "Manrope", token: "font-sans" },
	{ fn: "Schibsted_Grotesk", token: "font-heading" },
	{ fn: "Geist_Mono", token: "font-mono" },
] as const;

const fontsPath = (app: string) =>
	join(REPO_ROOT, `apps/${app}/src/app/fonts.ts`);
const layoutPath = (app: string) =>
	join(REPO_ROOT, `apps/${app}/src/app/layout.tsx`);
const read = (path: string) => readFileSync(path, "utf8");

/** The options object literal passed to `<fn>({ … })`, or undefined. */
function fontCallOptions(src: string, fn: string): string | undefined {
	return new RegExp(`\\b${fn}\\(\\s*\\{([\\s\\S]*?)\\}\\s*\\)`).exec(src)?.[1];
}

/** First `var(--x)` in the `:root` declaration of `--<token>` in brand.css. */
function brandFontVar(token: string): string | undefined {
	const decl = new RegExp(`--${token}\\s*:\\s*([^;]+);`).exec(read(BRAND_CSS));
	return decl?.[1] ? /var\(\s*--([\w-]+)/.exec(decl[1])?.[1] : undefined;
}

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === "node_modules" || name === ".next") continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.(tsx?|mjs|css)$/.test(name)) out.push(full);
	}
	return out;
}

describe("font setup guard", () => {
	it.each(APPS)(
		"%s layout imports `fontVariables` from ./fonts and applies it on <html>",
		(app) => {
			const src = read(layoutPath(app));
			expect(src).toMatch(
				/import\s*\{\s*fontVariables\s*\}\s*from\s*["']\.\/fonts["']/,
			);
			const html = /<html\b[^>]*>/.exec(src)?.[0] ?? "";
			expect(html).toMatch(/className=\{fontVariables\}/);
		},
	);

	it.each(APPS)(
		"%s fonts.ts loads Manrope, Schibsted_Grotesk, Geist_Mono from next/font/google with display swap and subsets latin",
		(app) => {
			expect(existsSync(fontsPath(app)), `apps/${app}/src/app/fonts.ts`).toBe(
				true,
			);
			const src = read(fontsPath(app));
			const imported =
				/import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["']/.exec(
					src,
				)?.[1] ?? "";
			for (const { fn } of FONTS) {
				expect(imported, `${fn} imported`).toMatch(new RegExp(`\\b${fn}\\b`));
				const options = fontCallOptions(src, fn);
				expect(options, `${fn}({ … }) called`).toBeDefined();
				expect(options).toMatch(/subsets:\s*\[\s*["']latin["']\s*\]/);
				expect(options).toMatch(/display:\s*["']swap["']/);
				expect(options).toMatch(/variable:\s*["']--[\w-]+["']/);
			}
			expect(src).toMatch(/export const fontVariables\b/);
		},
	);

	it("fonts.ts is identical in every app", () => {
		const [first, ...rest] = APPS.map((app) =>
			existsSync(fontsPath(app)) ? read(fontsPath(app)) : "",
		);
		for (const [i, src] of rest.entries()) {
			expect(src, `apps/${APPS[i + 1]}/src/app/fonts.ts`).toBe(first);
		}
	});

	it("fonts.ts variable names equal the var() names in brand.css --font-sans/--font-heading/--font-mono", () => {
		const src = existsSync(fontsPath("saas")) ? read(fontsPath("saas")) : "";
		for (const { fn, token } of FONTS) {
			const variable = /variable:\s*["']--([\w-]+)["']/.exec(
				fontCallOptions(src, fn) ?? "",
			)?.[1];
			expect(variable, `${fn} variable`).toBeDefined();
			expect(brandFontVar(token), `brand.css --${token}`).toBe(variable);
		}
	});

	it("no app imports `geist/font`", () => {
		const hits = APPS.flatMap((app) =>
			walk(join(REPO_ROOT, `apps/${app}/src`))
				.filter((file) => /["']geist\/font/.test(read(file)))
				.map((file) => relative(REPO_ROOT, file)),
		);
		expect(hits).toEqual([]);
	});
});
