import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { defaultLocale, locales } from "@/i18n/config";
import { baseOptions } from "@/lib/layout.shared";

interface HomePageProps {
	params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
	return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
	params,
}: HomePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "home" });

	const languages: Record<string, string> = {};
	for (const loc of locales) {
		languages[loc] = loc === defaultLocale ? "/" : `/${loc}`;
	}

	return {
		title: t("metaTitle"),
		description: t("metaDescription"),
		alternates: {
			languages,
		},
		openGraph: {
			title: t("metaTitle"),
			description: t("metaDescription"),
			locale,
		},
	};
}

export default async function HomePage({ params }: HomePageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("home");

	return (
		<HomeLayout
			{...baseOptions()}
			nav={{
				title: t("title"),
				children: <LocaleSwitcher />,
			}}
		>
			<div className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
				<h1 className="mb-4 font-bold text-4xl tracking-tight sm:text-5xl">
					{t("title")}
				</h1>
				<p className="mb-2 text-fd-muted-foreground text-lg">{t("subtitle")}</p>
				<p className="mb-8 max-w-2xl text-fd-muted-foreground">
					{t("description")}
				</p>
				<div className="flex flex-wrap items-center justify-center gap-4">
					<a
						href={`/${locale}/docs`}
						className="inline-flex items-center justify-center rounded-lg bg-fd-primary px-6 py-3 font-medium text-fd-primary-foreground transition-colors hover:bg-fd-primary/90"
					>
						{t("exploreDocs")}
					</a>
					<a
						href="https://github.com/Fuutu-company/fuutu-stack"
						target="_blank"
						rel="noreferrer noopener"
						className="inline-flex items-center justify-center rounded-lg border border-fd-border px-6 py-3 font-medium transition-colors hover:bg-fd-accent"
					>
						{t("viewOnGithub")}
					</a>
				</div>
			</div>
		</HomeLayout>
	);
}
