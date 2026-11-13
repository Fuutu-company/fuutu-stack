import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: app UI uses semantic color tokens, never Tailwind palette
 * colors, and `warning` / `info` are fills, never text.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const SCAN_DIRS = [
	"apps/saas/src",
	"apps/marketing/src",
	"apps/docs/src",
	"packages/ui/src",
];
const PALETTE_ALLOWLIST = new Set([
	"packages/ui/src/components/media-frame/constants.ts",
]);

const PALETTE_CLASS =
	/\b(bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|divide)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}/;
const STATUS_TEXT = /\btext-(warning|info)(?!-foreground)(?![\w-])/;

/** Gradient text (`bg-clip-text` + `text-transparent`) or a `from|via|to-primary` gradient stop. */
const GRADIENT =
	/(?=.*\bbg-clip-text\b)(?=.*\btext-transparent\b)|(?<![\w-])(from|via|to)-primary\b/;
const GRADIENT_HINT =
	"No gradient text and no primary gradients (DESIGN.md, Tactile: no AI-design tells). Use AreaBackdrop or an area fill for accents.";

const HINT =
	"Use semantic tokens (bg-primary, text-muted-foreground, border-border, …); warning/info are fills, use text-warning-foreground / text-info-foreground on them. See DESIGN.md.";

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		if (name === "__tests__" || name === "node_modules" || name === ".next") {
			continue;
		}
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.tsx?$/.test(name)) out.push(full);
	}
	return out;
}

function findHits(pattern: RegExp, allowlist: Set<string>): string[] {
	const hits: string[] = [];
	for (const dir of SCAN_DIRS) {
		for (const file of walk(join(REPO_ROOT, dir))) {
			const rel = relative(REPO_ROOT, file);
			if (allowlist.has(rel)) continue;
			readFileSync(file, "utf8")
				.split("\n")
				.forEach((line, i) => {
					if (pattern.test(line)) hits.push(`${rel}:${i + 1}`);
				});
		}
	}
	return hits;
}

describe("semantic colors guard", () => {
	it("has no Tailwind palette color classes", () => {
		expect(findHits(PALETTE_CLASS, PALETTE_ALLOWLIST), HINT).toEqual([]);
	});

	it("has no text-warning / text-info without -foreground", () => {
		expect(findHits(STATUS_TEXT, new Set()), HINT).toEqual([]);
	});

	it("has no gradient text and no primary gradients in apps", () => {
		const hits = findHits(GRADIENT, new Set()).filter((hit) =>
			hit.startsWith("apps/"),
		);
		expect(hits, GRADIENT_HINT).toEqual([]);
	});
});
