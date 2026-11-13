import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: every component exported from `@fuutu/ui` is imported on the
 * `/design` page, so the live style guide cannot silently fall behind the
 * component library.
 *
 * TypeScript 7 ships no JavaScript compiler API, so exports are collected by
 * following the `export * from` chain of the barrel and parsing the export
 * declarations in each module.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const UI_INDEX = join(REPO_ROOT, "packages/ui/src/index.ts");
const DESIGN_DIR = join(REPO_ROOT, "apps/saas/src/modules/app/design-system");

function resolveModule(from: string, specifier: string): string | null {
	const base = join(dirname(from), specifier);
	for (const candidate of [
		`${base}.ts`,
		`${base}.tsx`,
		join(base, "index.ts"),
		join(base, "index.tsx"),
	]) {
		if (existsSync(candidate)) return candidate;
	}
	return null;
}

function specifierName(raw: string): string | null {
	const spec = raw.trim();
	if (!spec || spec.startsWith("type ")) return null;
	const parts = spec.split(/\s+as\s+/);
	return (parts[1] ?? parts[0] ?? "").trim() || null;
}

/** Value exports of a module, following `export * from` and re-exports. */
function collectValueExports(file: string, seen = new Set<string>()): string[] {
	if (seen.has(file)) return [];
	seen.add(file);
	const source = readFileSync(file, "utf8");
	const names: string[] = [];

	for (const m of source.matchAll(
		/^export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_$][\w$]*)/gm,
	)) {
		if (m[1]) names.push(m[1]);
	}
	for (const m of source.matchAll(
		/^export\s*\{([^}]*)\}(?:\s*from\s*["']([^"']+)["'])?/gm,
	)) {
		for (const raw of (m[1] ?? "").split(",")) {
			const name = specifierName(raw);
			if (name) names.push(name);
		}
	}
	for (const m of source.matchAll(/^export\s*\*\s*from\s*["']([^"']+)["']/gm)) {
		const target = m[1] ? resolveModule(file, m[1]) : null;
		if (target) names.push(...collectValueExports(target, seen));
	}
	return names;
}

/**
 * Parts that `DialogContent`, `SheetContent` and `SelectContent` already
 * compose internally. They need their Radix parent's context, so they cannot
 * render on their own; the page shows them through those parents.
 */
const COMPOSED_INTERNALLY: Record<string, string> = {
	DialogOverlay: "DialogContent",
	DialogPortal: "DialogContent",
	SheetOverlay: "SheetContent",
	SheetPortal: "SheetContent",
	SelectScrollUpButton: "SelectContent",
	SelectScrollDownButton: "SelectContent",
};

/** Components and hooks start uppercase and contain a lowercase letter; UPPER_SNAKE constants are data. */
function isComponentName(name: string): boolean {
	return /^[A-Z]/.test(name) && /[a-z]/.test(name);
}

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full, out);
		else if (/\.tsx?$/.test(name)) out.push(full);
	}
	return out;
}

/** Names imported from "@fuutu/ui" (type-only imports included: `typeof X` is a use). */
function collectUiImports(files: string[]): Set<string> {
	const imported = new Set<string>();
	for (const file of files) {
		const source = readFileSync(file, "utf8");
		for (const m of source.matchAll(
			/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']@fuutu\/ui["']/g,
		)) {
			for (const raw of (m[1] ?? "").split(",")) {
				const original = raw
					.trim()
					.replace(/^type\s+/, "")
					.split(/\s+as\s+/)[0]
					?.trim();
				if (original) imported.add(original);
			}
		}
	}
	return imported;
}

/** The `/design` module is optional: a buyer who deletes it should not get a red suite. */
describe.skipIf(!existsSync(DESIGN_DIR))("/design page coverage", () => {
	const exported = [...new Set(collectValueExports(UI_INDEX))]
		.filter(isComponentName)
		.sort();

	it("finds the @fuutu/ui component exports", () => {
		expect(exported).toContain("Button");
		expect(exported).toContain("SidebarMenuSubButton");
		expect(exported).toContain("PricingCompact");
		expect(exported).not.toContain("WCAG_AA");
		expect(exported.length).toBeGreaterThan(100);
	});

	it("keeps the internal-parts allowlist honest", () => {
		const imported = collectUiImports(walk(DESIGN_DIR));
		for (const [name, host] of Object.entries(COMPOSED_INTERNALLY)) {
			expect(exported, `${name} is no longer exported`).toContain(name);
			expect(imported, `${host} must be on /design for ${name}`).toContain(
				host,
			);
		}
	});

	it("imports every exported @fuutu/ui component", () => {
		const imported = collectUiImports(walk(DESIGN_DIR));
		const missing = exported.filter(
			(name) => !imported.has(name) && !(name in COMPOSED_INTERNALLY),
		);
		expect(
			missing,
			`Missing on /design (apps/saas/src/modules/app/design-system): ${missing.join(", ")}`,
		).toEqual([]);
	});
});
