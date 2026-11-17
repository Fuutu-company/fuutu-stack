import { PrivacySettingsButton } from "@fuutu/analytics/consent";
import { config } from "@fuutu/config";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { LanguageSelectText } from "fumadocs-ui/layouts/shared/slots/language-select";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { appDocs } from "@/app-docs";
import { DocsHome } from "@/components/home/docs-home";
import { LanguageSelect } from "@/components/language-select";
import { LegalLinks } from "@/components/legal-links";
import { locales } from "@/i18n/config";
import { baseOptions, PRIVACY_LINK_CLASS } from "@/lib/layout.shared";
import { docsHomeMetadata } from "@/lib/page-metadata";

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

	return docsHomeMetadata(
		{
			title: t("metaTitle", { appName: config.app.name }),
			description: t("metaDescription"),
			locale,
		},
		appDocs.metadata,
	);
}

export default async function HomePage({ params }: HomePageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("home");

	return (
		<HomeLayout
			{...baseOptions()}
			nav={{ title: t("title", { appName: config.app.name }) }}
			slots={{
				languageSelect: { root: LanguageSelect, text: LanguageSelectText },
			}}
		>
			{appDocs.Home ? (
				<appDocs.Home locale={locale} />
			) : (
				<DocsHome locale={locale} />
			)}
			<footer className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pb-8">
				<LegalLinks locale={locale} className={PRIVACY_LINK_CLASS} />
				<PrivacySettingsButton className={PRIVACY_LINK_CLASS} />
			</footer>
		</HomeLayout>
	);
}
