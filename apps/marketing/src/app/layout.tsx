import "./globals.css";
import { KIT_GENERATOR_META } from "@fuutu/config";
import type { Locale } from "@fuutu/i18n";
import { getDirection } from "@fuutu/i18n";
import { getBaseUrl } from "@fuutu/utils";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { getLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { Providers } from "@/modules/shared/providers";

export const metadata = {
	metadataBase: new URL(getBaseUrl({ defaultPort: 3001 })),
	// `<meta name="generator">` — second-line fingerprint signal. See
	// `apps/saas/src/app/layout.tsx` for the rationale and the license
	// reference.
	generator: KIT_GENERATOR_META,
	icons: {
		icon: [
			{ url: "/favicon/favicon.svg", type: "image/svg+xml" },
			{ url: "/favicon/favicon-96x96.png", sizes: "96x96", type: "image/png" },
		],
		apple: "/favicon/apple-touch-icon.png",
	},
	openGraph: {
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
			<body className="antialiased">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
