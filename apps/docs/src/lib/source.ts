import { docs } from "fumadocs-mdx:collections/server";
import { type InferPageType, loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";
import { i18n } from "@/lib/i18n";
import { openapi } from "@/lib/openapi";

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

export async function getLLMText(page: InferPageType<typeof source>) {
	if (page.type === "openapi") {
		return `# ${page.data.title}\n\n${page.data.description ?? ""}`;
	}

	const processed = await page.data.getText("processed");

	return `# ${page.data.title}

${processed}`;
}
