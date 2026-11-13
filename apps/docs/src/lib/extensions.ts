import type { MDXComponents } from "mdx/types";
import type { ComponentType } from "react";

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
}
