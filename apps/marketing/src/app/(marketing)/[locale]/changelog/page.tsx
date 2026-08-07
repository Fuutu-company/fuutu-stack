import { changelog, getChangelogBody } from "@fuutu/content";
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

	return (
		<div className="container mx-auto max-w-3xl px-4 py-16">
			<h1 className="mb-4 font-bold text-4xl tracking-tight">{t("title")}</h1>
			<p className="mb-12 text-lg text-muted-foreground">{t("description")}</p>
			{changelog.length === 0 ? (
				<p className="text-muted-foreground">{t("empty")}</p>
			) : (
				<ol className="flex flex-col gap-12">
					{changelog.map((entry) => {
						const Body = getChangelogBody(entry, locale);
						return (
							<li
								key={entry.slug}
								id={entry.frontmatter.version}
								className="border-l-2 pl-6"
							>
								<div className="mb-1 text-muted-foreground text-xs">
									{entry.frontmatter.publishedAt} · v{entry.frontmatter.version}
								</div>
								<h2 className="mb-2 font-semibold text-xl">
									{entry.frontmatter.title}
								</h2>
								{entry.frontmatter.description ? (
									<p className="mb-4 text-muted-foreground">
										{entry.frontmatter.description}
									</p>
								) : null}
								<div className="prose prose-sm prose-neutral dark:prose-invert">
									<Body />
								</div>
							</li>
						);
					})}
				</ol>
			)}
		</div>
	);
}
