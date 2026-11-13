import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { changelogMeta } from "../changelog-meta";
import { changelog } from "../index";

const SRC = join(import.meta.dirname, "..");

describe("changelogMeta (@fuutu/content/changelog-meta)", () => {
	it("lists the same entries as the TSX collection, in the same order", () => {
		expect(changelogMeta.map((m) => m.slug)).toEqual(
			changelog.map((c) => c.slug),
		);
	});

	it("is the single source of the collection's frontmatter", () => {
		for (const entry of changelog) {
			const meta = changelogMeta.find((m) => m.slug === entry.slug);
			expect(meta?.frontmatter, entry.slug).toBe(entry.frontmatter);
		}
	});

	it("validates frontmatter (publishedAt parseable, title set)", () => {
		for (const { slug, frontmatter } of changelogMeta) {
			expect(frontmatter.title.length, slug).toBeGreaterThan(0);
			expect(Number.isNaN(new Date(frontmatter.publishedAt).getTime())).toBe(
				false,
			);
		}
	});

	it("stays importable without React (no .tsx imports)", () => {
		const source = readFileSync(join(SRC, "changelog-meta.ts"), "utf8");
		const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
			(m) => m[1] ?? "",
		);
		for (const spec of imports) {
			expect(spec, spec).not.toMatch(/react|\.tsx$|^\.\/index$|^\.\.?$/);
			if (spec.startsWith("./changelog/")) {
				expect(spec, spec).toMatch(/\.meta$/);
			}
		}
	});

	it("is exported as @fuutu/content/changelog-meta", () => {
		const pkg = JSON.parse(
			readFileSync(join(SRC, "../package.json"), "utf8"),
		) as { exports: Record<string, { default: string }> };
		expect(pkg.exports["./changelog-meta"]?.default).toBe(
			"./src/changelog-meta.ts",
		);
	});
});
