import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as metaModule from "../changelog-meta";
import { changelog } from "../index";

const { changelogMeta } = metaModule;

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

	it("stays importable without React (no .tsx imports, app list included)", () => {
		for (const file of ["changelog-meta.ts", "app-changelog.ts"]) {
			const source = readFileSync(join(SRC, file), "utf8");
			const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
				(m) => m[1] ?? "",
			);
			for (const spec of imports) {
				expect(spec, `${file}: ${spec}`).not.toMatch(
					/react|\.tsx$|^\.\/index$|^\.\.?$|app-changelog-bodies/,
				);
				if (spec.startsWith("./changelog/")) {
					expect(spec, `${file}: ${spec}`).toMatch(/\.meta$/);
				}
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

describe("changelog drafts (unreleased entries)", () => {
	const slugs = (list: readonly { slug: string }[]) => list.map((e) => e.slug);

	it("keeps a draft out of changelogMeta — what feeds and MCP version checks read", () => {
		expect(changelogMeta.every((e) => !e.frontmatter.draft)).toBe(true);
	});

	it("keeps a draft out of the collection the changelog page renders", () => {
		expect(changelog.every((e) => !e.frontmatter.draft)).toBe(true);
		for (const { slug } of metaModule.changelogDraftMeta) {
			expect(slugs(changelog)).not.toContain(slug);
		}
	});

	it("still validates drafts and lists them separately", () => {
		const drafts = (
			metaModule as {
				changelogDraftMeta?: readonly {
					slug: string;
					frontmatter: { draft?: boolean };
				}[];
			}
		).changelogDraftMeta;
		expect(Array.isArray(drafts)).toBe(true);
		expect((drafts ?? []).every((d) => d.frontmatter.draft === true)).toBe(
			true,
		);
		expect(
			metaModule.changelogFrontmatterSchema.parse({
				title: "T",
				publishedAt: "2026-01-01",
				draft: true,
			}).draft,
		).toBe(true);
	});
});

describe("changelog translations", () => {
	/** Entries per `<h3>` section of a changelog body, read from its source. */
	function sections(file: string): number[] {
		const source = readFileSync(join(SRC, "changelog", file), "utf8");
		return source
			.split("<h3>")
			.slice(1)
			.map((section) => section.split("<li>").length - 1);
	}

	it("every translated body has the same sections and entries as the English one", () => {
		const all = [...changelogMeta, ...metaModule.changelogDraftMeta];
		for (const { slug } of all) {
			const translations = readdirSync(join(SRC, "changelog")).filter(
				(file) =>
					file.startsWith(`${slug}.`) &&
					file.endsWith(".tsx") &&
					file !== `${slug}.tsx`,
			);
			if (!existsSync(join(SRC, "changelog", `${slug}.tsx`))) continue;
			for (const file of translations) {
				expect(sections(file), file).toEqual(sections(`${slug}.tsx`));
			}
		}
	});
});
