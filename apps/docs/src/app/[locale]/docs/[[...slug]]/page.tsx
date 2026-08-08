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

import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { OpenAPIPage } from "@/components/openapi/api-page";
import { defaultLocale, locales } from "@/i18n/config";
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
	const gitConfig = {
		user: "Fuutu-company",
		repo: "fuutu-stack",
		branch: "main",
	};

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
					githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/apps/docs/content/docs/${page.path}`}
				/>
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
	return source.generateParams();
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	const { locale, slug } = await params;
	const page = source.getPage(slug, locale);
	if (!page) notFound();

	// Build hreflang alternates — all locales point to the same docs slug.
	// `page.url` includes the locale prefix (e.g. `/de/docs`), so we rebuild
	// the base path from slugs to avoid double-prefixing.
	const basePath = `/docs${page.slugs.length > 0 ? `/${page.slugs.join("/")}` : ""}`;
	const languages: Record<string, string> = {};
	for (const loc of locales) {
		languages[loc] = loc === defaultLocale ? basePath : `/${loc}${basePath}`;
	}

	return {
		title: page.data.title,
		description: page.data.description,
		alternates: {
			languages,
		},
		openGraph: {
			title: page.data.title,
			description: page.data.description,
			locale,
			images: getPageImage(page).url,
		},
		twitter: {
			card: "summary_large_image",
			title: page.data.title,
			description: page.data.description,
		},
	};
}
