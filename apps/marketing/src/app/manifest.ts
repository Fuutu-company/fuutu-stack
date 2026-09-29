import { getMessagesForLocale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import type { MetadataRoute } from "next";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
	const messages = await getMessagesForLocale(
		i18nConfig.defaultLocale,
		"marketing",
	);
	const brand = messages.app.brand;

	return {
		name: brand,
		short_name: brand,
		description: `${brand} — ${messages.app.tagline}`,
		start_url: "/",
		display: "standalone",
		background_color: "#ffffff",
		theme_color: "#000000",
		icons: [
			{
				src: "/favicon/web-app-manifest-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "maskable",
			},
			{
				src: "/favicon/web-app-manifest-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
}
