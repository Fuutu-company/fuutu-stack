import { posts } from "@fuutu/content";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/navigation";

interface BlogPageProps {
	params: Promise<{ locale: string }>;
}

export async function generateMetadata({
	params,
}: BlogPageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "blog" });
	return { title: t("title"), description: t("description") };
}

export default async function BlogPage({ params }: BlogPageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("blog");

	const visible = posts.filter((p) => !p.frontmatter.draft);

	return (
		<div className="container mx-auto max-w-3xl px-4 py-16">
			<h1 className="mb-4 font-bold text-4xl tracking-tight">{t("title")}</h1>
			<p className="mb-12 text-lg text-muted-foreground">{t("description")}</p>
			{visible.length === 0 ? (
				<p className="text-muted-foreground">{t("empty")}</p>
			) : (
				<ul className="divide-y border-y">
					{visible.map((post) => (
						<li key={post.slug} className="py-6">
							<Link
								href={`/blog/${post.slug}`}
								className="block transition-colors hover:text-primary"
							>
								<h2 className="font-semibold text-xl">
									{post.frontmatter.title}
								</h2>
								<p className="mt-1 text-muted-foreground text-sm">
									{post.frontmatter.description}
								</p>
								{post.frontmatter.tags && post.frontmatter.tags.length > 0 ? (
									<div className="mt-3 flex flex-wrap gap-1.5">
										{post.frontmatter.tags.map((tag) => (
											<span
												key={tag}
												className="rounded-full border px-2 py-0.5 text-muted-foreground text-xs"
											>
												{tag}
											</span>
										))}
									</div>
								) : null}
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
