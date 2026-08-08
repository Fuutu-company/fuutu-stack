import "./global.css";
import { KIT_GENERATOR_META } from "@fuutu/config";
import type { Locale } from "@fuutu/i18n";
import { getDirection } from "@fuutu/i18n";
import { getBaseUrl } from "@fuutu/utils";
import { RootProvider } from "fumadocs-ui/provider/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { getLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { ThemeProvider } from "@/modules/shared/providers/theme-provider";

export const metadata = {
	metadataBase: new URL(getBaseUrl({ defaultPort: 4000 })),
	generator: KIT_GENERATOR_META,
	icons: {
		icon: [
			{ url: "/favicon/favicon.svg", type: "image/svg+xml" },
			{ url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
		],
		apple: "/favicon/apple-touch-icon.png",
	},
	openGraph: {
		type: "website",
		siteName: "Fuutu Stack Docs",
		images: [{ url: "/og-image.png", width: 1200, height: 630 }],
	},
	twitter: {
		card: "summary_large_image",
		images: ["/og-image.png"],
	},
};

export default async function RootLayout({ children }: PropsWithChildren) {
	const locale = (await getLocale()) as Locale;
	const direction = getDirection(locale);

	return (
		<html
			lang={locale}
			dir={direction}
			className={`${GeistSans.variable} ${GeistMono.variable}`}
			suppressHydrationWarning
		>
			<body className="flex min-h-screen flex-col">
				<RootProvider>
					<ThemeProvider>{children}</ThemeProvider>
				</RootProvider>
			</body>
		</html>
	);
}
