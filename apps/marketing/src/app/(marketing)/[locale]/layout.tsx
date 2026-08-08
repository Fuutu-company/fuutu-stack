import { ConsentBanner } from "@fuutu/analytics/consent";
import { AnalyticsScript } from "@fuutu/analytics/script";
import { MarketingFooter } from "@marketing/components/footer";
import { MarketingNavbar } from "@marketing/components/navbar";
import { Providers } from "@shared/providers";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { locales } from "@/i18n/config";

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

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			<Providers>
				<div className="flex min-h-screen flex-col">
					<MarketingNavbar />
					<main className="flex-1 overflow-x-hidden pt-[4.5rem]">
						{children}
					</main>
					<MarketingFooter />
				</div>
				<ConsentBanner />
				<AnalyticsScript />
			</Providers>
		</NextIntlClientProvider>
	);
}
