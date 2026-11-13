import { changelog, getChangelogBody } from "@fuutu/content";
import { Badge, Card } from "@fuutu/ui";
import { PageIntro } from "@shared/components/page-intro";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

interface ChangelogPageProps {
	params: Promise<{ locale: string }>;
}

export async function generateMetadata({
	params,
}: ChangelogPageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "changelog" });
	return { title: t("title"), description: t("description") };
}

export default async function ChangelogPage({ params }: ChangelogPageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("changelog");
	const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "long" });

	return (
		<div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 md:pt-20">
			<PageIntro title={t("title")} description={t("description")} />
			{changelog.length === 0 ? (
				<p className="mt-12 text-muted-foreground">{t("empty")}</p>
			) : (
				<ol className="mt-12 flex flex-col gap-5">
					{changelog.map((entry) => {
						const Body = getChangelogBody(entry, locale);
						return (
							<li
								key={entry.slug}
								id={entry.frontmatter.version}
								className="scroll-mt-24"
							>
								<Card className="gap-0 px-6 py-6 md:px-8 md:py-8">
									<div className="flex flex-wrap items-center gap-2.5 text-muted-foreground text-sm">
										<Badge variant="secondary" className="font-mono">
											v{entry.frontmatter.version}
										</Badge>
										<time dateTime={entry.frontmatter.publishedAt}>
											{dateFormat.format(
												new Date(entry.frontmatter.publishedAt),
											)}
										</time>
									</div>
									<h2 className="mt-4 font-extrabold font-heading text-2xl leading-tight tracking-heading">
										{entry.frontmatter.title}
									</h2>
									{entry.frontmatter.description ? (
										<p className="mt-2 text-muted-foreground leading-7">
											{entry.frontmatter.description}
										</p>
									) : null}
									<div className="prose prose-sm mt-5">
										<Body />
									</div>
								</Card>
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}
