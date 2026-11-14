import type { InferPageType } from "fumadocs-core/source";
import type { DocsSlots } from "fumadocs-ui/layouts/docs";
import type { MDXComponents } from "mdx/types";
import type { MetadataRoute } from "next";
import type { ImageResponse } from "next/og";
import type { ComponentType } from "react";
import type { DocsMetadataOptions } from "./page-metadata";
import type { source } from "./source";

export type { AppDocsSource, CodeTheme } from "./docs-source-config";
export type { DocsMetadataOptions } from "./page-metadata";

/** One font for `next/og` (`{ name, data, weight?, style? }`). */
export type OgImageFont = NonNullable<
	NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]
>[number];

/** A docs page (MDX or OpenAPI) as the kit's `source` loader returns it. */
export type DocsPage = InferPageType<typeof source>;

/** One sitemap entry before the app hook, kit defaults filled in. */
export interface DocsSitemapRoute {
	/** Locale-free path: `""` (docs home), `/docs/<slugs>`. */
	path: string;
	locale: string;
	kind: "home" | "page";
	/** The docs page (`kind: "page"`) — e.g. for a real `lastModified`. */
	page?: DocsPage;
	lastModified: string | Date;
	changeFrequency: NonNullable<
		MetadataRoute.Sitemap[number]["changeFrequency"]
	>;
	priority: number;
}

/** Values the app sets for one sitemap entry; unset fields keep the kit's. */
export type DocsSitemapOverride = Partial<
	Pick<DocsSitemapRoute, "lastModified" | "changeFrequency" | "priority">
>;

/**
 * `/robots.txt` over the kit's (`*` may crawl `/`, sitemap
 * `<site>/sitemap.xml`). An object replaces each field it sets: `rules`
 * as a whole (one group or a list of `{ userAgent, allow, disallow,
 * crawlDelay }` groups), `sitemap` (one URL or a list), `host`. A
 * function gets the kit result and returns the final one.
 */
export type AppRobots =
	| Partial<MetadataRoute.Robots>
	| ((kit: MetadataRoute.Robots) => MetadataRoute.Robots);

/**
 * Docs-app extension contract — fill it in `src/app-docs.tsx`.
 * Every field is optional; unset fields leave the kit docs unchanged.
 */
export interface AppDocs {
	/**
	 * Extra MDX components (or overrides of kit ones by name), available in
	 * every docs page. Per-page overrides (relative links) still win.
	 */
	mdxComponents?: MDXComponents;
	/** Rendered at the top of the docs sidebar (fumadocs `sidebar.banner`). */
	SidebarBanner?: ComponentType<{ locale: string }>;
	/**
	 * Replacements for fumadocs layout slots (`sidebar`, `header`,
	 * `container`, …), merged after the kit's own `languageSelect` slot.
	 * Slot components must be client components. Unset: the kit layout.
	 */
	layoutSlots?: Partial<DocsSlots>;
	/**
	 * Extra page actions, rendered after the kit's "Copy Markdown" and
	 * "Open" buttons on every docs page (MDX and OpenAPI — check
	 * `page.type` if an action fits only one). `url` is the page URL,
	 * `markdownUrl` its raw-Markdown URL.
	 */
	PageActions?: ComponentType<{
		url: string;
		markdownUrl: string;
		locale: string;
	}>;
	/**
	 * Target of the "Open in GitHub" page action. Unset: the kit's GitHub
	 * URL of the page file; `null`: no link on any page; a function: the
	 * URL for that page, or `null` to hide it there.
	 */
	sourceUrl?: ((page: DocsPage) => string | null) | null;
	/**
	 * Post-process the Markdown the kit serves for a page (`<page>.mdx`,
	 * `/llms-full.txt`), e.g. to strip internal notes or add a footer.
	 */
	processMarkdown?: (
		markdown: string,
		page: DocsPage,
	) => string | Promise<string>;
	/** Docs page `<title>` template and canonical base (unset: neither). */
	metadata?: DocsMetadataOptions;
	/**
	 * Open Graph images of docs pages. `Image` renders in the kit route
	 * (`/og/docs/…`, 1200×630 via `next/og` — inline styles, no Tailwind)
	 * in place of the fumadocs card; `url` points a page's `og:image`
	 * elsewhere (your own route, a CDN); `fonts` are passed to
	 * `ImageResponse` (e.g. the brand heading font for `Image`) — a list or
	 * a loader called per image (read the files lazily).
	 */
	ogImage?: {
		Image?: ComponentType<{
			page: DocsPage;
			title?: string;
			description?: string;
			site: string;
		}>;
		url?: (page: DocsPage) => string;
		fonts?:
			| readonly OgImageFont[]
			| (() => readonly OgImageFont[] | Promise<readonly OgImageFont[]>);
	};
	/**
	 * Per-entry sitemap values (`/sitemap.xml`) — called for every path and
	 * locale with the kit defaults; return overrides (e.g. a real
	 * `lastModified`) or `undefined` to keep them.
	 */
	sitemap?: (route: DocsSitemapRoute) => DocsSitemapOverride | undefined;
	/** `/robots.txt` rules, sitemap and host — see `AppRobots`. */
	robots?: AppRobots;
}
