import type { InferPageType } from "fumadocs-core/source";
import type { MDXComponents } from "mdx/types";
import type { MetadataRoute } from "next";
import type { ComponentType } from "react";
import type { DocsMetadataOptions } from "./page-metadata";
import type { source } from "./source";

export type { AppDocsSource, CodeTheme } from "./docs-source-config";
export type { DocsMetadataOptions } from "./page-metadata";

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
	 * Extra page actions, rendered after the kit's "Copy Markdown" and
	 * "Open" buttons on every MDX docs page. `url` is the page URL,
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
	 * elsewhere (your own route, a CDN).
	 */
	ogImage?: {
		Image?: ComponentType<{
			page: DocsPage;
			title?: string;
			description?: string;
			site: string;
		}>;
		url?: (page: DocsPage) => string;
	};
	/**
	 * Per-entry sitemap values (`/sitemap.xml`) — called for every path and
	 * locale with the kit defaults; return overrides (e.g. a real
	 * `lastModified`) or `undefined` to keep them.
	 */
	sitemap?: (route: DocsSitemapRoute) => DocsSitemapOverride | undefined;
}
