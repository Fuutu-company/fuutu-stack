import { getLegalDocument } from "@fuutu/content";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

interface LegalPageProps {
	params: Promise<{ locale: string; slug: string }>;
}

const KNOWN_SLUGS = ["privacy", "terms", "imprint"] as const;

export function generateStaticParams() {
	return KNOWN_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({
	params,
}: LegalPageProps): Promise<Metadata> {
	const { locale, slug } = await params;
	const doc = getLegalDocument(slug, locale);
	if (!doc) return {};
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
		<article className="container mx-auto max-w-3xl px-4 py-16">
			<header className="mb-10">
				<h1 className="mb-2 font-bold text-4xl tracking-tight">
					{doc.frontmatter.title}
				</h1>
				<p className="text-muted-foreground text-sm">
					{doc.frontmatter.updatedAt}
				</p>
			</header>
			<div className="prose prose-neutral dark:prose-invert">
				<Body />
			</div>
		</article>
	);
}
