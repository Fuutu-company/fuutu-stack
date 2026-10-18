import { ConsentBanner, ConsentProvider } from "@fuutu/analytics/consent";
import { AnalyticsScript } from "@fuutu/analytics/script";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { locales } from "@/i18n/config";

export function generateStaticParams() {
	return locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps extends PropsWithChildren {
	params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
	children,
	params,
}: LocaleLayoutProps) {
	const { locale } = await params;
	setRequestLocale(locale);

	const messages = await getMessages();

	return (
		<NextIntlClientProvider locale={locale} messages={messages}>
			{/* ConsentProvider must wrap ConsentBanner + AnalyticsScript —
			    they share the consent decision via useConsent() / the
			    consent cookie. Same contract as saas + marketing. */}
			<ConsentProvider>
				{children}
				<ConsentBanner />
				<AnalyticsScript />
			</ConsentProvider>
		</NextIntlClientProvider>
	);
}
