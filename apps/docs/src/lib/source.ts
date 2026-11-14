import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { processMarkdown } from "@/lib/app-docs-hooks";
import { i18n } from "@/lib/i18n";
import { openapi } from "@/lib/openapi";
import { openapiLLMText } from "@/lib/openapi-llm-text";

export const source = loader(
	{
		docs: docs.toFumadocsSource(),
		openapi: await openapi.staticSource({
			groupBy: "tag",
		}),
	},
	{
		baseUrl: "/docs",
		i18n,
		plugins: [lucideIconsPlugin(), openapi.loaderPlugin()],
	},
);

export function getPageImage(page: InferPageType<typeof source>) {
	// `page.slugs` is locale-free — prefix non-default locales so
	// translated pages get their own OG image instead of the
	// default-locale one.
	const segments =
		page.locale && page.locale !== i18n.defaultLanguage
			? [page.locale, ...page.slugs, "image.png"]
			: [...page.slugs, "image.png"];

	return {
		segments,
		url: `/og/docs/${segments.join("/")}`,
	};
}

/**
 * Page Markdown for the llms routes. The routes pass `appDocs.processMarkdown`
 * so this module never imports `@/app-docs` (which app overrides may
 * import back from here — a cycle).
 */
export async function getLLMText(
	page: InferPageType<typeof source>,
	hook?: (
		markdown: string,
		page: InferPageType<typeof source>,
	) => string | Promise<string>,
) {
	return processMarkdown(await kitLLMText(page), page, hook);
}

async function kitLLMText(page: InferPageType<typeof source>) {
	if (page.type === "openapi") {
		return openapiLLMText({
			title: page.data.title ?? "",
			description: page.data.description,
			props: page.data.getOpenAPIPageProps(),
		});
	}

	const processed = await page.data.getText("processed");

	return `# ${page.data.title}

${processed}`;
}
