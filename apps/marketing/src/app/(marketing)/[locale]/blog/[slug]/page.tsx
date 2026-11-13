import { getPost, getPostBody, posts } from "@fuutu/content";
import { PageIntro } from "@shared/components/page-intro";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";

interface BlogPostPageProps {
	params: Promise<{ locale: string; slug: string }>;
}

export function generateStaticParams() {
	return posts
		.filter((p) => !p.frontmatter.draft)
		.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
	params,
}: BlogPostPageProps): Promise<Metadata> {
	const { locale, slug } = await params;
	const post = getPost(slug);
	if (!post || post.frontmatter.draft) {
		const t = await getTranslations({ locale, namespace: "notFound" });
		return { title: t("title") };
	}
	return {
		title: post.frontmatter.title,
		description: post.frontmatter.description,
	};
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
	const { locale, slug } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("blog");

	const post = getPost(slug);
	if (!post || post.frontmatter.draft) notFound();

	const publishedAt = new Intl.DateTimeFormat(locale, {
		dateStyle: "long",
	}).format(new Date(post.frontmatter.publishedAt));
	const authors = post.frontmatter.authors ?? [];

	const Body = getPostBody(post, locale);

	return (
		<article className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 md:pt-20">
			<PageIntro
				before={
					<Link
						href="/blog"
						className="inline-flex w-fit items-center gap-1.5 font-semibold text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
					>
						<ArrowLeft aria-hidden="true" className="size-4" />
						{t("backToList")}
					</Link>
				}
				title={post.frontmatter.title}
				description={post.frontmatter.description}
			>
				<p className="text-muted-foreground text-sm">
					<time dateTime={post.frontmatter.publishedAt}>{publishedAt}</time>
					{authors.length > 0 ? ` · ${authors.join(", ")}` : null}
				</p>
			</PageIntro>
			<div className="prose mt-12 border-border border-t pt-10">
				<Body />
			</div>
		</article>
	);
}
