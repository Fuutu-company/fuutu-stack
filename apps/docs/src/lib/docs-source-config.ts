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
}

export const KIT_DOCS_CONTENT_DIR = "content/docs";

export function docsContentDir(source: AppDocsSource): string {
	return source.contentDir ?? KIT_DOCS_CONTENT_DIR;
}
