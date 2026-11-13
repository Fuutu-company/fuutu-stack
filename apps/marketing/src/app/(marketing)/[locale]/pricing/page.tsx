import { PricingCardsPage } from "@marketing/pricing";
import { PageIntro } from "@shared/components/page-intro";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

interface PricingPageProps {
	params: Promise<{ locale: string }>;
}

export async function generateMetadata({
	params,
}: PricingPageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pricing" });
	return { title: t("title"), description: t("description") };
}

export default async function PricingPage({ params }: PricingPageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("pricing");

	return (
		<>
			<div className="mx-auto max-w-6xl px-4 pt-12 sm:px-6 md:pt-20">
				<PageIntro
					align="center"
					title={t("title")}
					description={t("description")}
				/>
			</div>
			<PricingCardsPage />
		</>
	);
}
