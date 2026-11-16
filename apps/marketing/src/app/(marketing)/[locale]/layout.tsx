import { ConsentBanner } from "@fuutu/analytics/consent";
import { AnalyticsScript } from "@fuutu/analytics/script";
import { config } from "@fuutu/config";
import { getLegalDocument } from "@fuutu/content";
import { i18nConfig } from "@fuutu/i18n/config";
import { legalPageUrl } from "@fuutu/utils/legal-links";
import { MarketingFooter } from "@marketing/components/footer";
import { MarketingNavbar } from "@marketing/components/navbar";
import { Providers } from "@shared/providers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { appMarketing } from "@/app-marketing";
import { locales } from "@/i18n/config";
import { urls } from "@/lib/urls";

export function generateStaticParams() {
	return locales.map((locale) => ({ locale }));
}

interface MarketingLayoutProps extends PropsWithChildren {
	params: Promise<{ locale: string }>;
}

export default async function MarketingLayout({
	children,
	params,
}: MarketingLayoutProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	const messages = await getMessages();
	const { LayoutSlot } = appMarketing;
	const privacyHref =
		config.features.legalPages && getLegalDocument("privacy", locale)
			? legalPageUrl("privacy", {
					marketingUrl: urls.marketing,
					locale,
					defaultLocale: i18nConfig.defaultLocale,
				})
			: null;

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<Providers>
				<div className="flex min-h-screen flex-col">
					<MarketingNavbar />
					<main className="flex-1 overflow-x-clip pt-[5.25rem]">
						{children}
					</main>
					<MarketingFooter />
				</div>
				<ConsentBanner privacyHref={privacyHref ?? undefined} />
				<AnalyticsScript />
				{LayoutSlot && <LayoutSlot locale={locale} />}
			</Providers>
		</NextIntlClientProvider>
	);
}
