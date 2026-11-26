import "./globals.css";
import { config, KIT_GENERATOR_META } from "@fuutu/config";
import type { PropsWithChildren } from "react";
import { Providers } from "@/components/providers";
import { fontVariables } from "./fonts";

export const metadata = {
	// Same `<meta name="generator">` fingerprint as the web apps
	// (LICENSE.md §6(5), §7) — the static export keeps it in every page.
	generator: KIT_GENERATOR_META,
	title: config.app.name,
	// public/logo.svg (pnpm assets:sync); without it the webview asks for /favicon.ico.
	icons: { icon: { url: "/logo.svg", type: "image/svg+xml" } },
};

/**
 * Static shell: rendered once at build time. Locale, theme and data are
 * client state (Providers) — the export has no server at runtime.
 */
export default function RootLayout({ children }: PropsWithChildren) {
	return (
		<html lang="en" className={fontVariables} suppressHydrationWarning>
			<body className="bg-background text-foreground antialiased">
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
