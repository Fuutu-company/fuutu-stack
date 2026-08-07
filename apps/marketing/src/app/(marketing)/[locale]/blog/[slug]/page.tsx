import { getPost, getPostBody, posts } from "@fuutu/content";
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
	const { slug } = await params;
	const post = getPost(slug);
	if (!post) return {};
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

	const Body = getPostBody(post, locale);

	return (
		<article className="container mx-auto max-w-3xl px-4 py-16">
			<Link
				href="/blog"
				className="mb-8 inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				{t("backToList")}
			</Link>
			<header className="mb-10">
				<h1 className="mb-3 font-bold text-4xl tracking-tight">
					{post.frontmatter.title}
				</h1>
				{post.frontmatter.description ? (
					<p className="mb-4 text-lg text-muted-foreground">
						{post.frontmatter.description}
					</p>
				) : null}
				<p className="text-muted-foreground text-sm">
					{post.frontmatter.publishedAt}
					{post.frontmatter.authors && post.frontmatter.authors.length > 0
						? ` · ${post.frontmatter.authors.join(", ")}`
						: ""}
				</p>
			</header>
			<div className="prose prose-neutral dark:prose-invert">
				<Body />
			</div>
		</article>
	);
}
