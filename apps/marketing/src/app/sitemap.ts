import { posts } from "@fuutu/content";
import { env } from "@fuutu/env/marketing";
import { i18nConfig } from "@fuutu/i18n/config";
import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/i18n/config";

const STATIC_ROUTES = [
	"",
	"/pricing",
	"/blog",
	"/changelog",
	"/contact",
	"/legal/privacy",
	"/legal/terms",
	"/legal/imprint",
];

/**
 * Build a locale-prefixed URL. The marketing app uses
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
	const base = env.NEXT_PUBLIC_MARKETING_URL ?? "https://stack.fuutu.com";
	const now = new Date();

	const entries: MetadataRoute.Sitemap = [];

	// Static routes — one entry per (locale, path) pair, plus hreflang alternates.
	if (!i18nConfig.enabled) {
		for (const path of STATIC_ROUTES) {
			entries.push({
				url: `${base}${path}`,
				lastModified: now,
				changeFrequency: "weekly",
				priority: path === "" ? 1 : 0.7,
			});
		}
	} else {
		for (const path of STATIC_ROUTES) {
			for (const locale of locales) {
				entries.push({
					url: localeUrl(base, locale, path),
					lastModified: now,
					changeFrequency: "weekly",
					priority: path === "" ? 1 : 0.7,
					alternates: alternates(base, path),
				});
			}
		}
	}

	const visiblePosts = posts.filter((p) => !p.frontmatter.draft);
	for (const post of visiblePosts) {
		const path = `/blog/${post.slug}`;
		for (const locale of locales) {
			entries.push({
				url: localeUrl(base, locale, path),
				lastModified: new Date(post.frontmatter.publishedAt),
				changeFrequency: "monthly",
				priority: 0.6,
				alternates: alternates(base, path),
			});
		}
	}

	// Changelog: no per-version entries — hash-fragment URLs are ignored by
	// crawlers. The /changelog index is already covered by STATIC_ROUTES.

	return entries;
}
