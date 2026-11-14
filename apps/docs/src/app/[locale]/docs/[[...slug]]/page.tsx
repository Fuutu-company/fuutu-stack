import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import { createRelativeLink } from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { appDocs } from "@/app-docs";
import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { OpenAPIPage } from "@/components/openapi/api-page";
import { resolveOgImageUrl, resolveSourceUrl } from "@/lib/app-docs-hooks";
import { docsPageMetadata } from "@/lib/page-metadata";
import { getPageImage, source } from "@/lib/source";
import { getMDXComponents } from "@/mdx-components";

interface PageProps {
	params: Promise<{ locale: string; slug?: string[] }>;
}

export default async function Page({ params }: PageProps) {
	const { locale, slug } = await params;
	setRequestLocale(locale);

	const page = source.getPage(slug, locale);
	if (!page) notFound();

	if (page.type === "openapi") {
		return (
			<DocsPage full>
				<DocsTitle>{page.data.title}</DocsTitle>
				<DocsDescription>{page.data.description}</DocsDescription>
				<DocsBody>
					<OpenAPIPage {...page.data.getOpenAPIPageProps()} />
				</DocsBody>
			</DocsPage>
		);
	}

	const MDX = page.data.body;
	const { PageActions } = appDocs;

	return (
		<DocsPage toc={page.data.toc} full={page.data.full}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription className="mb-0">
				{page.data.description}
			</DocsDescription>
			<div className="flex flex-row items-center gap-2 border-b pb-6">
				<LLMCopyButton markdownUrl={`${page.url}.mdx`} />
				<ViewOptions
					markdownUrl={`${page.url}.mdx`}
					githubUrl={resolveSourceUrl(page, appDocs.sourceUrl)}
				/>
				{PageActions && (
					<PageActions
						url={page.url}
						markdownUrl={`${page.url}.mdx`}
						locale={locale}
					/>
				)}
			</div>
			<DocsBody>
				<MDX
					components={getMDXComponents({
						a: createRelativeLink(source, page),
					})}
				/>
			</DocsBody>
		</DocsPage>
	);
}

export async function generateStaticParams() {
	return source.generateParams("slug", "locale");
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { locale, slug } = await params;
	const page = source.getPage(slug, locale);
	if (!page) notFound();

	// hreflang alternates — all locales point to the same docs slug.
	// `page.url` includes the locale prefix (e.g. `/de/docs`), so we rebuild
	// the base path from slugs to avoid double-prefixing.
	return docsPageMetadata(
		{
			title: page.data.title,
			description: page.data.description,
			locale,
			path: `/docs${page.slugs.length > 0 ? `/${page.slugs.join("/")}` : ""}`,
			image: resolveOgImageUrl(
				page,
				getPageImage(page).url,
				appDocs.ogImage?.url,
			),
		},
		appDocs.metadata,
	);
}
