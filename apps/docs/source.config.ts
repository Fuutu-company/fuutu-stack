import {
	defineConfig,
	defineDocs,
	frontmatterSchema,
	metaSchema,
} from "fumadocs-mdx/config";
import { z } from "zod";
import { appDocsSource } from "./app-docs-source";
import { docsContentDir, docsMdxOptions } from "./src/lib/docs-source-config";

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
	},
	meta: {
		schema: metaSchema,
	},
});

export default defineConfig({
	mdxOptions: docsMdxOptions(appDocsSource),
});
