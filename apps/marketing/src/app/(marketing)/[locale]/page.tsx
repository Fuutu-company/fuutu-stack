import { CTA } from "@marketing/home/components/cta";
import { FAQ } from "@marketing/home/components/faq";
import { FeatureBento } from "@marketing/home/components/feature-bento";
import { Hero } from "@marketing/home/components/hero";
import { IntegrationsStrip } from "@marketing/home/components/integrations-strip";
import { ProductTour } from "@marketing/home/components/product-tour";
import { SecurityBand } from "@marketing/home/components/security-band";
import { composeHomeSections } from "@marketing/home/compose-sections";
import { PricingCardsHome } from "@marketing/pricing";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { appMarketing } from "@/app-marketing";
import { locales } from "@/i18n/config";
import type { HomeSection, HomeSectionKey } from "@/lib/extensions";

/** Kit home sections, top to bottom — apps compose them in `app-marketing.tsx`. */
const KIT_HOME_SECTIONS: HomeSection<HomeSectionKey>[] = [
	{ key: "hero", Component: Hero },
	{ key: "integrations", Component: IntegrationsStrip },
	{ key: "features", Component: FeatureBento },
	{ key: "product-tour", Component: ProductTour },
	{ key: "security", Component: SecurityBand },
	{ key: "pricing", Component: PricingCardsHome },
	{ key: "faq", Component: FAQ },
	{ key: "cta", Component: CTA },
];

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

	const sections = composeHomeSections(
		KIT_HOME_SECTIONS,
		appMarketing.homeSections,
	);

	return (
		<>
			{sections.map(({ key, Component }) => (
				<Component key={key} />
			))}
		</>
	);
}
