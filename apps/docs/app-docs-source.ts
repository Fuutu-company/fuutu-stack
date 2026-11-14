import type { AppDocsSource } from "./src/lib/docs-source-config";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Config-time docs extensions (contract: `src/lib/docs-source-config.ts`),
 * read by `source.config.ts` — add yours here instead of editing it:
 *
 * - `contentDir`: content folder relative to `apps/docs` (default
 *   `content/docs`); the default "Open in GitHub" link follows it
 * - `frontmatter`: extra frontmatter fields, merged into the kit schema
 *   and typed on `page.data` (keep the key; `{}` adds nothing)
 *
 * Bundled at build time by fumadocs-mdx: import only `zod` and plain
 * TypeScript here — no React, no `@/` paths.
 *
 * ```ts
 * import { z } from "zod";
 * export const appDocsSource = {
 *   contentDir: "content/product",
 *   frontmatter: { since: z.string().optional() },
 * } satisfies AppDocsSource;
 * ```
 */
export const appDocsSource = {
	frontmatter: {},
} satisfies AppDocsSource;
