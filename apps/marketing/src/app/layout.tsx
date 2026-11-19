import "./globals.css";
import { config, KIT_GENERATOR_META } from "@fuutu/config";
import type { Locale } from "@fuutu/i18n";
import { getDirection } from "@fuutu/i18n";
import { getLocale } from "next-intl/server";
import type { PropsWithChildren } from "react";
import { marketingBaseUrl } from "@/lib/marketing-base-url";
import { fontVariables } from "./fonts";

export const metadata = {
	// Every page title gets the app name appended (`Pricing | Acme`); a
	// page that sets its own `title.absolute` opts out. Lives in the root
	// layout because a template skips the segment that defines it.
	title: { template: `%s | ${config.app.name}`, default: config.app.name },
	metadataBase: new URL(marketingBaseUrl()),
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
			className={fontVariables}
			suppressHydrationWarning
		>
			<body className="antialiased">{children}</body>
		</html>
	);
}
