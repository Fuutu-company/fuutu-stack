import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Docs-app SEO extensions: page metadata (`appDocs.metadata` — title
 * template, canonical base), OG images (`appDocs.ogImage`), sitemap values
 * (`appDocs.sitemap`) and code-block themes (`appDocsSource.codeThemes`).
 * Unset fields must reproduce the kit output exactly — and hreflang /
 * sitemap URLs never name a locale the docs do not serve.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const app = vi.hoisted(() => ({ appDocs: {} as Record<string, unknown> }));
vi.mock("@/app-docs", () => ({
	get appDocs() {
		return app.appDocs;
	},
}));

const i18n = vi.hoisted(() => ({
	i18nConfig: {
		enabled: true,
		locales: { en: {}, de: {} },
		defaultLocale: "en",
	},
}));
vi.mock("../../../../packages/i18n/config", () => i18n);
vi.mock("@/i18n/config", () => ({
	defaultLocale: "en",
	locales: ["en", "de"],
}));
vi.mock("../../../../packages/env/src/docs", () => ({
	env: { NEXT_PUBLIC_DOCS_URL: "https://docs.test" },
}));

type FakePage = { slugs: string[]; url: string; locale?: string };
const pages: Record<string, FakePage[]> = {
	en: [
		{ slugs: [], url: "/docs", locale: "en" },
		{ slugs: ["guide"], url: "/docs/guide", locale: "en" },
	],
	de: [
		{ slugs: [], url: "/de/docs", locale: "de" },
		{ slugs: ["guide"], url: "/de/docs/guide", locale: "de" },
	],
};
vi.mock("@/lib/source", () => ({
	source: {
		getPages: (locale?: string) => pages[locale ?? "en"] ?? [],
	},
}));

const { docsPageMetadata, hreflangLanguages } = await import(
	"../../../../apps/docs/src/lib/page-metadata"
);
const hooks = await import("../../../../apps/docs/src/lib/app-docs-hooks");
const config = await import("../../../../apps/docs/src/lib/docs-source-config");
type SitemapEntry = {
	url: string;
	lastModified?: string | Date;
	changeFrequency?: string;
	priority?: number;
	alternates?: unknown;
};
// Non-literal path: the sitemap imports `@/` aliases this package's tsc
// cannot follow; vitest resolves it like any import.
const SITEMAP = join(ROOT, "apps/docs/src/app/sitemap.ts");
const sitemap = (
	(await import(/* @vite-ignore */ SITEMAP)) as {
		default: () => SitemapEntry[];
	}
).default;

beforeEach(() => {
	app.appDocs = {};
	i18n.i18nConfig.enabled = true;
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-11-14T00:00:00.000Z"));
});
afterEach(() => {
	vi.useRealTimers();
});

const page = {
	title: "Theming",
	description: "Brand tokens",
	locale: "de",
	path: "/docs/guides/theming",
	image: "/og/docs/de/guides/theming/image.png",
};

describe("docs page metadata", () => {
	it("is the kit metadata without app options", () => {
		expect(docsPageMetadata(page, undefined)).toEqual({
			title: "Theming",
			description: "Brand tokens",
			alternates: {
				languages: {
					en: "/docs/guides/theming",
					de: "/de/docs/guides/theming",
				},
			},
			openGraph: {
				title: "Theming",
				description: "Brand tokens",
				locale: "de",
				images: "/og/docs/de/guides/theming/image.png",
			},
			twitter: {
				card: "summary_large_image",
				title: "Theming",
				description: "Brand tokens",
			},
		});
	});

	it("applies the title template and a canonical URL under the canonical base", () => {
		const meta = docsPageMetadata(page, {
			titleTemplate: "%s · Acme Docs",
			canonicalBase: "https://docs.acme.test/",
		});
		expect(meta.title).toBe("Theming · Acme Docs");
		expect(meta.alternates).toEqual({
			canonical: "https://docs.acme.test/de/docs/guides/theming",
			languages: {
				en: "/docs/guides/theming",
				de: "/de/docs/guides/theming",
			},
		});
		expect(meta.openGraph).toMatchObject({ title: "Theming" });
		expect(
			docsPageMetadata(
				{ ...page, locale: "en" },
				{
					canonicalBase: "https://docs.acme.test",
				},
			).alternates,
		).toMatchObject({
			canonical: "https://docs.acme.test/docs/guides/theming",
		});
	});

	it("emits no hreflang alternates while i18n is disabled", () => {
		i18n.i18nConfig.enabled = false;
		expect(hreflangLanguages("/docs/x")).toBeUndefined();
		expect(docsPageMetadata(page, undefined)).not.toHaveProperty("alternates");
	});

	it("maps the docs home to / and /<locale>", () => {
		expect(hreflangLanguages("")).toEqual({ en: "/", de: "/de" });
	});

	it("the docs page and docs home build their metadata through the helpers", () => {
		expect(
			read("apps/docs/src/app/[locale]/docs/[[...slug]]/page.tsx"),
		).toMatch(
			/docsPageMetadata\(\s*\{[\s\S]*?image: resolveOgImageUrl\(\s*page,\s*getPageImage\(page\)\.url,\s*appDocs\.ogImage\?\.url,?\s*\),?\s*\},\s*appDocs\.metadata,?\s*\)/,
		);
		const home = read("apps/docs/src/app/[locale]/page.tsx");
		expect(home).toMatch(/hreflangLanguages\(""\)/);
		expect(home).not.toMatch(/for \(const loc of locales\)/);
	});
});

describe("docs OG image", () => {
	const docsPage = { path: "en/a.mdx", url: "/docs/a" };

	it("keeps the kit image URL without a hook and uses the app's with one", () => {
		expect(
			hooks.resolveOgImageUrl(docsPage, "/og/docs/a/image.png", undefined),
		).toBe("/og/docs/a/image.png");
		expect(
			hooks.resolveOgImageUrl(
				docsPage,
				"/og/docs/a/image.png",
				(p: { url: string }) => `https://cdn.test${p.url}.png`,
			),
		).toBe("https://cdn.test/docs/a.png");
	});

	it("the OG route renders appDocs.ogImage.Image in place of the fumadocs card", () => {
		const route = read("apps/docs/src/app/og/docs/[...slug]/route.tsx");
		expect(route).toMatch(/\{ appDocs \} from "@\/app-docs"/);
		expect(route).toMatch(
			/const Image = appDocs\.ogImage\?\.Image;[\s\S]*?Image \? \(\s*<Image\s+page=\{page\}\s+title=\{page\.data\.title\}\s+description=\{page\.data\.description\}\s+site=\{config\.app\.name\}\s*\/>\s*\) : \(\s*<DefaultImage/,
		);
	});
});

describe("docs code themes", () => {
	it("adds no MDX options by default and sets the rehype-code themes when given", () => {
		expect(config.docsMdxOptions({})).toEqual({});
		expect(
			config.docsMdxOptions({
				codeThemes: { light: "vitesse-light", dark: "vitesse-dark" },
			}),
		).toEqual({
			rehypeCodeOptions: {
				themes: { light: "vitesse-light", dark: "vitesse-dark" },
			},
		});
	});

	it("source.config.ts passes them to fumadocs-mdx", () => {
		expect(read("apps/docs/source.config.ts")).toMatch(
			/mdxOptions: docsMdxOptions\(appDocsSource\)/,
		);
	});
});

describe("docs sitemap", () => {
	const NOW = new Date("2026-11-14T00:00:00.000Z");
	const languages = (path: string) => ({
		languages: {
			en: `https://docs.test${path}`,
			de: `https://docs.test/de${path}`,
		},
	});
	const entry = (locale: string, path: string, priority: number) => ({
		url: `https://docs.test${locale === "en" ? "" : "/de"}${path}`,
		lastModified: NOW,
		changeFrequency: "weekly",
		priority,
		alternates: languages(path),
	});

	it("lists home + pages per enabled locale with alternates (kit default)", () => {
		expect(sitemap()).toEqual([
			entry("en", "", 1),
			entry("de", "", 1),
			entry("en", "/docs", 0.8),
			entry("en", "/docs/guide", 0.8),
			entry("de", "/docs", 0.8),
			entry("de", "/docs/guide", 0.8),
		]);
	});

	it("lists only default-locale URLs without alternates while i18n is disabled", () => {
		i18n.i18nConfig.enabled = false;
		const entries = sitemap();
		expect(entries.map((e) => e.url)).toEqual([
			"https://docs.test",
			"https://docs.test/docs",
			"https://docs.test/docs/guide",
		]);
		for (const e of entries) expect(e.alternates).toBeUndefined();
	});

	it("applies the app's per-entry values over the kit defaults", () => {
		const hook = vi.fn((route: { path: string }) =>
			route.path === "/docs/guide"
				? { priority: 0.5, lastModified: new Date("2026-09-09") }
				: undefined,
		);
		app.appDocs = { sitemap: hook };
		const entries = sitemap();
		const guide = entries.filter((e) => e.url.endsWith("/docs/guide"));
		expect(guide.map((e) => [e.priority, e.changeFrequency])).toEqual([
			[0.5, "weekly"],
			[0.5, "weekly"],
		]);
		expect(guide[0]?.lastModified).toEqual(new Date("2026-09-09"));
		expect(hook).toHaveBeenCalledWith({
			path: "",
			locale: "en",
			kind: "home",
			lastModified: NOW,
			changeFrequency: "weekly",
			priority: 1,
		});
		expect(hook).toHaveBeenCalledWith(
			expect.objectContaining({
				path: "/docs/guide",
				locale: "de",
				kind: "page",
				page: pages.de?.[1],
			}),
		);
	});
});
