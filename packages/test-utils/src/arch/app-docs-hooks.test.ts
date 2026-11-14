import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Docs-app hooks behind `appDocs.sourceUrl` / `appDocs.processMarkdown`
 * and `appDocsSource.contentDir` / `.frontmatter`. Unset fields must
 * reproduce the kit's "Open in GitHub" link and Markdown output exactly.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const source = vi.hoisted(() => ({
	appDocsSource: {} as { contentDir?: string },
}));
vi.mock("../../../../apps/docs/app-docs-source", () => ({
	get appDocsSource() {
		return source.appDocsSource;
	},
}));

const hooks = await import("../../../../apps/docs/src/lib/app-docs-hooks");
const config = await import("../../../../apps/docs/src/lib/docs-source-config");

const page = { path: "en/guides/theming.mdx", url: "/docs/guides/theming" };

describe("docs source link", () => {
	it("defaults to the kit's GitHub blob URL under the content dir", () => {
		expect(hooks.resolveSourceUrl(page, undefined)).toBe(
			"https://github.com/Fuutu-company/fuutu-stack/blob/main/apps/docs/content/docs/en/guides/theming.mdx",
		);
	});

	it("follows an app content dir in the default URL", () => {
		source.appDocsSource = { contentDir: "content/product" };
		try {
			expect(hooks.resolveSourceUrl(page, undefined)).toBe(
				"https://github.com/Fuutu-company/fuutu-stack/blob/main/apps/docs/content/product/en/guides/theming.mdx",
			);
		} finally {
			source.appDocsSource = {};
		}
	});

	it("is hidden when sourceUrl is null", () => {
		expect(hooks.resolveSourceUrl(page, null)).toBeNull();
	});

	it("uses the app's URL, or hides the link per page", () => {
		const sourceUrl = (p: { url: string }) =>
			p.url.includes("internal") ? null : `https://git.example.test${p.url}`;
		expect(hooks.resolveSourceUrl(page, sourceUrl)).toBe(
			"https://git.example.test/docs/guides/theming",
		);
		expect(
			hooks.resolveSourceUrl({ ...page, url: "/docs/internal" }, sourceUrl),
		).toBeNull();
	});
});

describe("docs content dir", () => {
	it("defaults to content/docs and takes the app override", () => {
		expect(config.docsContentDir({})).toBe("content/docs");
		expect(config.docsContentDir({ contentDir: "content/product" })).toBe(
			"content/product",
		);
	});
});

describe("docs markdown hook", () => {
	it("returns the kit Markdown unchanged without a hook", async () => {
		expect(await hooks.processMarkdown("# A\n\nbody", page, undefined)).toBe(
			"# A\n\nbody",
		);
	});

	it("passes Markdown and page to the app hook, sync or async", async () => {
		const sync = (md: string, p: { url: string }) => `${md}\n\n${p.url}`;
		const async = async (md: string) => md.toUpperCase();
		expect(await hooks.processMarkdown("# A", page, sync)).toBe(
			"# A\n\n/docs/guides/theming",
		);
		expect(await hooks.processMarkdown("# a", page, async)).toBe("# A");
	});
});

describe("kit wiring", () => {
	it("source.config.ts reads the content dir and merges the app frontmatter", () => {
		const cfg = read("apps/docs/source.config.ts");
		expect(cfg).toMatch(/dir: docsContentDir\(appDocsSource\)/);
		expect(cfg).toMatch(/\.\.\.appDocsSource\.frontmatter,?\s*\}\)/);
	});

	it("the docs page and getLLMText go through the hooks", () => {
		expect(
			read("apps/docs/src/app/[locale]/docs/[[...slug]]/page.tsx"),
		).toMatch(/resolveSourceUrl\(page, appDocs\.sourceUrl\)/);
		const llms = read("apps/docs/src/lib/source.ts");
		expect(llms).toMatch(/processMarkdown\([\s\S]*?hook\)/);
		// source.ts must not import app-docs (an app override may import source).
		expect(llms).not.toMatch(/app-docs"/);
		for (const route of [
			"apps/docs/src/app/llms.mdx/[locale]/docs/[[...slug]]/route.ts",
			"apps/docs/src/app/llms-full.txt/route.ts",
		]) {
			expect(read(route)).toMatch(
				/getLLMText\(\w+, appDocs\.processMarkdown\)/,
			);
		}
	});
});
