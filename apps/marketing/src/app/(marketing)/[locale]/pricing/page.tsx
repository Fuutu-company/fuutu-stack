import { PricingCardsPage } from "@marketing/pricing";
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
			<section className="py-16">
				<div className="container mx-auto max-w-6xl px-4 text-center">
					<h1 className="mb-4 font-bold text-4xl">{t("title")}</h1>
					<p className="mx-auto max-w-2xl text-lg text-muted-foreground">
						{t("description")}
					</p>
				</div>
			</section>
			<PricingCardsPage />
		</>
	);
}
