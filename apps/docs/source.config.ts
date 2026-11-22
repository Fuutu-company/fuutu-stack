import {
	defineConfig,
	defineDocs,
	frontmatterSchema,
	metaSchema,
} from "fumadocs-mdx/config";
import { z } from "zod";
import { appDocsSource as appSource } from "./app-docs-source";
import {
	type AppDocsSource,
	docsContentDir,
	docsMdxOptions,
} from "./src/lib/docs-source-config";

// Widened to the contract: `satisfies` in app-docs-source.ts keeps only the
// fields the app set, and every optional field is read below.
const appDocsSource: AppDocsSource = appSource;

export const docs = defineDocs({
	dir: docsContentDir(appDocsSource),
	docs: {
		schema: frontmatterSchema.extend({
			tags: z.array(z.string()).optional(),
			author: z.string().optional(),
			draft: z.boolean().optional(),
			...appDocsSource.frontmatter,
		}),
		postprocess: {
			includeProcessedMarkdown: true,
		},
		...(appDocsSource.files?.docs ? { files: appDocsSource.files.docs } : {}),
	},
	meta: {
		schema: metaSchema,
		...(appDocsSource.files?.meta ? { files: appDocsSource.files.meta } : {}),
	},
});

export default defineConfig({
	mdxOptions: docsMdxOptions(appDocsSource),
});
