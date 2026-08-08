import "./globals.css";
import { ConsentBanner } from "@fuutu/analytics/consent";
import { AnalyticsScript } from "@fuutu/analytics/script";
import { KIT_GENERATOR_META } from "@fuutu/config";
import type { Locale } from "@fuutu/i18n";
import { getDirection } from "@fuutu/i18n";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { Providers } from "@/modules/shared/providers";

export const metadata = {
	// Embeds `<meta name="generator" content="Fuutu-Stack x.y.z" />` in
	// every server-rendered HTML response. Together with the `X-Framework`
	// header (Hono + next.config + proxy) this gives the Fuutu compliance
	// crawler a fingerprint signature that survives header-stripping
	// reverse proxies. Removing this is a license violation
	// (LICENSE.md §6(5), §7).
	generator: KIT_GENERATOR_META,
	title: {
		default: "Fuutu Stack",
		template: "%s — Fuutu Stack",
	},
	icons: {
		icon: [
			{ url: "/favicon/favicon.svg", type: "image/svg+xml" },
			{ url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
		],
		apple: "/favicon/apple-touch-icon.png",
	},
};

export default async function RootLayout({ children }: PropsWithChildren) {
	const locale = (await getLocale()) as Locale;
	const direction = getDirection(locale);
	const messages = await getMessages();

	return (
		<html
			lang={locale}
			dir={direction}
			className={`${GeistSans.variable} ${GeistMono.variable}`}
			suppressHydrationWarning
		>
			<body className="antialiased">
				<NextIntlClientProvider locale={locale} messages={messages}>
					<Providers>
						{children}
						<ConsentBanner />
						<AnalyticsScript />
					</Providers>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
