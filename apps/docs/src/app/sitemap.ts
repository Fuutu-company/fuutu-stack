import { env } from "@fuutu/env/docs";
import { i18nConfig } from "@fuutu/i18n/config";
import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/i18n/config";
import { source } from "@/lib/source";

/**
 * Build a locale-prefixed URL. The docs app uses
 * `localePrefix: "as-needed"` — i.e. the default locale is served
 * without prefix and every other locale lives under `/<locale>/...`.
 */
function localeUrl(base: string, locale: string, path: string): string {
	if (locale === defaultLocale) return `${base}${path}`;
	return `${base}/${locale}${path}`;
}

function alternates(base: string, path: string) {
	const languages: Record<string, string> = {};
	for (const locale of locales) {
		languages[locale] = localeUrl(base, locale, path);
	}
	return { languages };
}

export default function sitemap(): MetadataRoute.Sitemap {
	const base = env.NEXT_PUBLIC_DOCS_URL ?? "http://localhost:4000";
	const now = new Date();

	const entries: MetadataRoute.Sitemap = [];

	// Home page — one entry per locale with hreflang alternates
	const homePath = "";
	if (i18nConfig.enabled) {
		for (const locale of locales) {
			entries.push({
				url: localeUrl(base, locale, homePath),
				lastModified: now,
				changeFrequency: "weekly",
				priority: 1,
				alternates: alternates(base, homePath),
			});
		}
	} else {
		entries.push({
			url: `${base}${homePath}`,
			lastModified: now,
			changeFrequency: "weekly",
			priority: 1,
		});
	}

	// Docs pages — all pages from the source (MDX + OpenAPI)
	const pages = source.getPages();

	if (i18nConfig.enabled) {
		for (const page of pages) {
			const path = page.url;
			for (const locale of locales) {
				entries.push({
					url: localeUrl(base, locale, path),
					lastModified: now,
					changeFrequency: "weekly",
					priority: 0.8,
					alternates: alternates(base, path),
				});
			}
		}
	} else {
		for (const page of pages) {
			entries.push({
				url: `${base}${page.url}`,
				lastModified: now,
				changeFrequency: "weekly",
				priority: 0.8,
			});
		}
	}

	return entries;
}
