import { PricingCardsPage, PricingPageHeader } from "@marketing/pricing";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { appMarketing } from "@/app-marketing";
import { withAppMetadata } from "@/lib/page-metadata";

interface PricingPageProps {
	params: Promise<{ locale: string }>;
}

export async function generateMetadata({
	params,
}: PricingPageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "pricing" });
	return withAppMetadata(
		{ title: t("title"), description: t("description") },
		appMarketing.metadata?.pricing,
		locale,
	);
}

export default async function PricingPage({ params }: PricingPageProps) {
	const { locale } = await params;
	setRequestLocale(locale);
	const t = await getTranslations("pricing");

	return (
		<>
			<PricingPageHeader title={t("title")} description={t("description")} />
			<PricingCardsPage />
		</>
	);
}
