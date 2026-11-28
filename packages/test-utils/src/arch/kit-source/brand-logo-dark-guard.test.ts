import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The brand mark in dark mode uses `logo-dark` (theme.css), never
 * `dark:invert`: inverting turns a coloured logo into its negative. The
 * default filter is still `invert(1)` for a dark monochrome mark; a brand
 * sets `--logo-dark-filter: none` (or its own filter) in brand.css.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../../");
const SCAN_DIRS = [
	"apps/saas/src",
	"apps/marketing/src",
	"apps/docs/src",
	"apps/desktop/src",
	"packages/ui/src",
];

/** Files allowed to invert in dark mode, with the reason. */
const ALLOWED: Record<string, string> = {
	"packages/ui/src/components/logo-rail/logo-item.tsx":
		"third-party logos, opt-in per item (invertInDark), not the brand mark",
};

function files(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry.startsWith(".")) continue;
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) out.push(...files(full));
		else if (/\.(tsx?|mdx?)$/.test(entry)) out.push(full);
	}
	return out;
}

describe("brand mark in dark mode", () => {
	it("theme.css defines logo-dark with a brand-overridable filter", () => {
		const theme = readFileSync(
			join(REPO_ROOT, "packages/config/theme.css"),
			"utf8",
		);
		expect(theme).toMatch(
			/@utility logo-dark \{[\s\S]*?filter: var\(--logo-dark-filter, invert\(1\)\)/,
		);
	});

	it("no brand mark uses dark:invert", () => {
		const hits: string[] = [];
		for (const dir of SCAN_DIRS) {
			for (const file of files(join(REPO_ROOT, dir))) {
				const rel = relative(REPO_ROOT, file);
				if (rel in ALLOWED) continue;
				readFileSync(file, "utf8")
					.split("\n")
					.forEach((line, i) => {
						if (line.includes("dark:invert")) hits.push(`${rel}:${i + 1}`);
					});
			}
		}
		expect(hits).toEqual([]);
	});
});
