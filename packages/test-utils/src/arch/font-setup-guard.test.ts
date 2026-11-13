import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: every app loads the same fonts the same way.
 *
 * - `apps/<app>/src/app/fonts.ts` makes exactly three font loader calls
 *   (sans, heading, mono), each imported from `next/font/google` or
 *   `next/font/local`, with a `variable` and `display: "swap"` (Google calls
 *   also `subsets`, local calls `src`), and exports `fontVariables`. Any
 *   families are allowed; the files are identical across apps.
 * - Each root layout applies `fontVariables` on `<html>`.
 * - The `var()` names the brand.css `--font-sans/--font-heading/--font-mono`
 *   stacks read are declared as a `variable` in fonts.ts, otherwise the stacks
 *   silently fall back to system fonts.
 * - The `geist` package is not used for fonts anymore.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const APPS = ["saas", "marketing", "docs"] as const;
const BRAND_CSS = join(REPO_ROOT, "packages/config/brand.css");
const ROLES = ["font-sans", "font-heading", "font-mono"] as const;

type Loader = "next/font/google" | "next/font/local";

const fontsPath = (app: string) =>
	join(REPO_ROOT, `apps/${app}/src/app/fonts.ts`);
const layoutPath = (app: string) =>
	join(REPO_ROOT, `apps/${app}/src/app/layout.tsx`);
const read = (path: string) => readFileSync(path, "utf8");

/** Local binding name → loader module, for every `next/font` import. */
function fontLoaders(src: string): Map<string, Loader> {
	const loaders = new Map<string, Loader>();
	for (const [, names = ""] of src.matchAll(
		/import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["']/g,
	)) {
		for (const name of names.split(",")) {
			const local = name
				.trim()
				.split(/\s+as\s+/)
				.pop();
			if (local) loaders.set(local, "next/font/google");
		}
	}
	for (const [, name = ""] of src.matchAll(
		/import\s+(\w+)\s+from\s*["']next\/font\/local["']/g,
	)) {
		loaders.set(name, "next/font/local");
	}
	return loaders;
}

/** The body of every `<fn>({ … })` options object, braces balanced. */
function callOptions(src: string, fn: string): string[] {
	const bodies: string[] = [];
	for (const match of src.matchAll(new RegExp(`\\b${fn}\\(\\s*\\{`, "g"))) {
		const start = match.index + match[0].length;
		let depth = 1;
		let quote: string | undefined;
		for (let i = start; i < src.length; i++) {
			const char = src[i];
			if (quote) {
				if (char === "\\") i++;
				else if (char === quote) quote = undefined;
			} else if (char === '"' || char === "'" || char === "`") quote = char;
			else if (char === "{") depth++;
			else if (char === "}" && --depth === 0) {
				bodies.push(src.slice(start, i));
				break;
			}
		}
	}
	return bodies;
}

/** First `var(--x)` name in the declaration of `--<role>`. */
function brandFontVar(brandCss: string, role: string): string | undefined {
	const decl = new RegExp(`--${role}\\s*:\\s*([^;]+);`).exec(brandCss);
	return decl?.[1] ? /var\(\s*--([\w-]+)/.exec(decl[1])?.[1] : undefined;
}

/** Everything wrong with a fonts.ts against the brand.css font stacks. */
function fontsFileProblems(src: string, brandCss: string): string[] {
	const problems: string[] = [];
	const calls = [...fontLoaders(src)].flatMap(([fn, loader]) =>
		callOptions(src, fn).map((options) => ({ fn, loader, options })),
	);
	if (calls.length !== ROLES.length) {
		problems.push(
			`expected ${ROLES.length} font loader calls (sans, heading, mono) from next/font/google or next/font/local, found ${calls.length}`,
		);
	}
	const variables: string[] = [];
	for (const { fn, loader, options } of calls) {
		const variable = /variable:\s*["']--([\w-]+)["']/.exec(options)?.[1];
		if (variable) variables.push(variable);
		else problems.push(`${fn}(): missing variable: "--…"`);
		if (!/display:\s*["']swap["']/.test(options)) {
			problems.push(`${fn}(): missing display: "swap"`);
		}
		if (loader === "next/font/google" && !/\bsubsets:\s*\[/.test(options)) {
			problems.push(`${fn}(): missing subsets (next/font/google)`);
		}
		if (loader === "next/font/local" && !/\bsrc:/.test(options)) {
			problems.push(`${fn}(): missing src (next/font/local)`);
		}
	}
	for (const role of ROLES) {
		const name = brandFontVar(brandCss, role);
		if (!name) problems.push(`brand.css --${role} reads no var(--…)`);
		else if (!variables.includes(name)) {
			problems.push(
				`brand.css --${role} reads var(--${name}), which no fonts.ts loader declares as its variable`,
			);
		}
	}
	if (!/export const fontVariables\b/.test(src)) {
		problems.push("fonts.ts does not export `fontVariables`");
	}
	return problems;
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

const BRAND_FIXTURE = `:root {
	--font-sans: var(--font-body), ui-sans-serif, sans-serif;
	--font-heading: var(--font-display), ui-sans-serif, sans-serif;
	--font-mono: var(--font-code), ui-monospace, monospace;
}`;

const fixture = (imports: string, calls: string[]) =>
	`${imports}\n${calls.join("\n")}\nexport const fontVariables = "";\n`;

describe("fontsFileProblems", () => {
	it("accepts Inter / Fraunces / JetBrains_Mono from next/font/google", () => {
		const src = fixture(
			`import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";`,
			[
				`const sans = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });`,
				`const heading = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });`,
				`const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });`,
			],
		);
		expect(fontsFileProblems(src, BRAND_FIXTURE)).toEqual([]);
	});

	it("accepts next/font/local with src and variable", () => {
		const src = fixture(`import localFont from "next/font/local";`, [
			`const sans = localFont({\n\tsrc: [{ path: "./fonts/body.woff2", weight: "100 900" }],\n\tvariable: "--font-body",\n\tdisplay: "swap",\n});`,
			`const heading = localFont({ src: "./fonts/display.woff2", variable: "--font-display", display: "swap" });`,
			`const mono = localFont({ src: "./fonts/code.woff2", variable: "--font-code", display: "swap" });`,
		]);
		expect(fontsFileProblems(src, BRAND_FIXTURE)).toEqual([]);
	});

	it("rejects a fonts.ts with only two families", () => {
		const src = fixture(
			`import { Inter, JetBrains_Mono } from "next/font/google";`,
			[
				`const sans = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });`,
				`const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });`,
			],
		);
		const problems = fontsFileProblems(src, BRAND_FIXTURE).join("\n");
		expect(problems).toMatch(/found 2/);
		expect(problems).toMatch(/--font-heading/);
	});

	it("rejects a variable that brand.css --font-heading does not read", () => {
		const src = fixture(
			`import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";`,
			[
				`const sans = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });`,
				`const heading = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });`,
				`const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-code", display: "swap" });`,
			],
		);
		expect(fontsFileProblems(src, BRAND_FIXTURE)).toEqual([
			"brand.css --font-heading reads var(--font-display), which no fonts.ts loader declares as its variable",
		]);
	});

	it("rejects a call without display swap, a Google call without subsets and a local call without src", () => {
		const src = fixture(
			`import { Inter } from "next/font/google";\nimport localFont from "next/font/local";`,
			[
				`const sans = Inter({ variable: "--font-body", display: "swap" });`,
				`const heading = localFont({ variable: "--font-display", display: "swap" });`,
				`const mono = localFont({ src: "./code.woff2", variable: "--font-code" });`,
			],
		);
		expect(fontsFileProblems(src, BRAND_FIXTURE)).toEqual([
			"Inter(): missing subsets (next/font/google)",
			"localFont(): missing src (next/font/local)",
			'localFont(): missing display: "swap"',
		]);
	});
});

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
		"%s fonts.ts loads three fonts from next/font/google or next/font/local whose variables the brand.css font stacks read",
		(app) => {
			expect(existsSync(fontsPath(app)), `apps/${app}/src/app/fonts.ts`).toBe(
				true,
			);
			expect(fontsFileProblems(read(fontsPath(app)), read(BRAND_CSS))).toEqual(
				[],
			);
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

	it("no app imports `geist/font`", () => {
		const hits = APPS.flatMap((app) =>
			walk(join(REPO_ROOT, `apps/${app}/src`))
				.filter((file) => /["']geist\/font/.test(read(file)))
				.map((file) => relative(REPO_ROOT, file)),
		);
		expect(hits).toEqual([]);
	});
});
