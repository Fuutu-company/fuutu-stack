import { posts } from "@fuutu/content";
import { Card } from "@fuutu/ui";
import { PageIntro } from "@shared/components/page-intro";
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
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

	const visible = posts.filter((p) => !p.frontmatter.draft);

	return (
		<div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 md:pt-20">
			<PageIntro title={t("title")} description={t("description")} />
			{visible.length === 0 ? (
				<p className="mt-12 text-muted-foreground">{t("empty")}</p>
			) : (
				<ul className="mt-12 flex flex-col gap-4">
					{visible.map((post) => {
						const meta = [
							...(post.frontmatter.authors ?? []),
							...(post.frontmatter.tags ?? []).map((tag) => `#${tag}`),
						];
						return (
							<li key={post.slug}>
								<Card className="relative gap-3 px-6 py-6 transition-shadow duration-150 focus-within:shadow-md hover:shadow-md motion-reduce:transition-none md:px-8 md:py-7">
									<p className="text-muted-foreground text-sm">
										<time dateTime={post.frontmatter.publishedAt}>
											{dateFormat.format(
												new Date(post.frontmatter.publishedAt),
											)}
										</time>
										{meta.length > 0 ? ` · ${meta.join(" · ")}` : null}
									</p>
									<h2 className="font-extrabold font-heading text-2xl leading-tight tracking-heading">
										<Link
											href={`/blog/${post.slug}`}
											className="underline-offset-4 outline-none after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:underline focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50"
										>
											{post.frontmatter.title}
										</Link>
									</h2>
									{post.frontmatter.description ? (
										<p className="text-muted-foreground leading-7">
											{post.frontmatter.description}
										</p>
									) : null}
								</Card>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
