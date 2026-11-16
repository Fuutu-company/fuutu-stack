import type { RehypeCodeOptions } from "fumadocs-core/mdx-plugins";
import type { ZodRawShape } from "zod";

/**
 * Config-time docs extensions — filled in `apps/docs/app-docs-source.ts`
 * and read by `source.config.ts` (fumadocs-mdx bundles that file at build
 * time, so it stays free of React / app imports). Every field is optional.
 */
export interface AppDocsSource {
	/**
	 * Content folder, relative to `apps/docs` (default `content/docs`).
	 * Holds `<locale>/…` page trees like the kit folder.
	 */
	contentDir?: string;
	/**
	 * Extra frontmatter fields (a Zod object shape), merged into the kit
	 * schema — same name overrides a kit field. Typed on `page.data`.
	 */
	frontmatter?: ZodRawShape;
	/**
	 * Shiki themes of code blocks, by color scheme (bundled theme names
	 * such as `"vitesse-light"`, or theme objects). Unset: the fumadocs
	 * defaults (`github-light` / `github-dark`).
	 */
	codeThemes?: { light: CodeTheme; dark: CodeTheme };
}

/** The multi-theme (`themes`) variant of the fumadocs rehype-code options. */
type ThemedCodeOptions = Extract<RehypeCodeOptions, { themes: unknown }>;

/** A Shiki theme as `rehypeCodeOptions.themes` takes it. */
export type CodeTheme = NonNullable<ThemedCodeOptions["themes"][string]>;

export const KIT_DOCS_CONTENT_DIR = "content/docs";

export function docsContentDir(source: AppDocsSource): string {
	return source.contentDir ?? KIT_DOCS_CONTENT_DIR;
}

/**
 * fumadocs-mdx `mdxOptions` from the app source config — `{}` (the kit
 * default) unless the app sets code themes. fumadocs merges
 * `rehypeCodeOptions` over its defaults, so only the themes change.
 */
export function docsMdxOptions(source: AppDocsSource): {
	rehypeCodeOptions?: Pick<ThemedCodeOptions, "themes">;
} {
	return source.codeThemes
		? { rehypeCodeOptions: { themes: { ...source.codeThemes } } }
		: {};
}
