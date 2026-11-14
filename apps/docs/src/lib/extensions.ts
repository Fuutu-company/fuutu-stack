import type { InferPageType } from "fumadocs-core/source";
import type { MDXComponents } from "mdx/types";
import type { ComponentType } from "react";
import type { source } from "./source";

export type { AppDocsSource } from "./docs-source-config";

/** A docs page (MDX or OpenAPI) as the kit's `source` loader returns it. */
export type DocsPage = InferPageType<typeof source>;

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
}
