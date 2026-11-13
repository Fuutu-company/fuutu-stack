import { CTA } from "@marketing/home/components/cta";
import { FAQ } from "@marketing/home/components/faq";
import { FeatureBento } from "@marketing/home/components/feature-bento";
import { Hero } from "@marketing/home/components/hero";
import { IntegrationsStrip } from "@marketing/home/components/integrations-strip";
import { ProductTour } from "@marketing/home/components/product-tour";
import { SecurityBand } from "@marketing/home/components/security-band";
import { PricingCardsHome } from "@marketing/pricing";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { locales } from "@/i18n/config";

export function generateStaticParams() {
	return locales.map((locale) => ({ locale }));
}

interface HomePageProps {
	params: Promise<{ locale: string }>;
}

export async function generateMetadata({
	params,
}: HomePageProps): Promise<Metadata> {
	const { locale } = await params;
	const t = await getTranslations({ locale, namespace: "home" });
	return {
		title: t("metaTitle"),
		description: t("hero.description"),
	};
}

export default async function HomePage({ params }: HomePageProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<>
			<Hero />
			<IntegrationsStrip />
			<FeatureBento />
			<ProductTour />
			<SecurityBand />
			<PricingCardsHome />
			<FAQ />
			<CTA />
		</>
	);
}
