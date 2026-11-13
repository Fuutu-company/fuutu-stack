import { getLegalDocument, legal } from "@fuutu/content";
import { Card } from "@fuutu/ui";
import { PageIntro } from "@shared/components/page-intro";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

interface LegalPageProps {
	params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
	return [...new Set(legal.map((d) => d.slug))].map((slug) => ({ slug }));
}

export async function generateMetadata({
	params,
}: LegalPageProps): Promise<Metadata> {
	const { locale, slug } = await params;
	const doc = getLegalDocument(slug, locale);
	if (!doc) {
		const t = await getTranslations({ locale, namespace: "notFound" });
		return { title: t("title") };
	}
	return {
		title: doc.frontmatter.title,
		description: `${doc.frontmatter.title} — ${doc.frontmatter.updatedAt}`,
	};
}

export default async function LegalPage({ params }: LegalPageProps) {
	const { locale, slug } = await params;
	setRequestLocale(locale);

	const doc = getLegalDocument(slug, locale);
	if (!doc) notFound();

	const Body = doc.body;
	return (
		<article className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 md:pt-20">
			<PageIntro title={doc.frontmatter.title}>
				<p className="text-muted-foreground text-sm">
					<time dateTime={doc.frontmatter.updatedAt}>
						{doc.frontmatter.updatedAt}
					</time>
				</p>
			</PageIntro>
			<Card className="mt-10 block px-6 py-8 md:px-10 md:py-10">
				<div className="prose">
					<Body />
				</div>
			</Card>
		</article>
	);
}
