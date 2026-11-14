import { legal, posts } from "@fuutu/content";
import { env } from "@fuutu/env/marketing";
import { getRoutableLocales } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import type { MetadataRoute } from "next";
import { appMarketing } from "@/app-marketing";
import { defaultLocale } from "@/i18n/config";
import type { SitemapRoute } from "@/lib/extensions";
import { definedFields } from "../lib/page-metadata";

const STATIC_ROUTES = ["", "/pricing", "/blog", "/changelog", "/contact"];

const LEGAL_ROUTES = [...new Set(legal.map((doc) => doc.slug))].map(
	(slug) => `/legal/${slug}`,
);

/**
 * Build a locale-prefixed URL. The marketing app uses
 * `localePrefix: "as-needed"` — i.e. the default locale is served
 * without prefix and every other locale lives under `/<locale>/...`.
 */
function localeUrl(base: string, locale: string, path: string): string {
	if (locale === defaultLocale) return `${base}${path}`;
	return `${base}/${locale}${path}`;
}

/**
 * One entry per (path, routable locale): every enabled locale with hreflang
 * alternates, or only the unprefixed default locale while i18n is disabled.
 * `appMarketing.sitemap` may override the kit's per-entry values.
 */
function entriesFor(
	base: string,
	route: Omit<SitemapRoute, "locale">,
): MetadataRoute.Sitemap {
	const locales = getRoutableLocales();
	const languages: Record<string, string> = {};
	for (const locale of locales) {
		languages[locale] = localeUrl(base, locale, route.path);
	}
	return locales.map((locale) => {
		const { lastModified, changeFrequency, priority } = {
			...route,
			...definedFields(appMarketing.sitemap?.({ ...route, locale }) ?? {}),
		};
		return {
			url: localeUrl(base, locale, route.path),
			lastModified,
			changeFrequency,
			priority,
			...(i18nConfig.enabled ? { alternates: { languages } } : {}),
		};
	});
}

export default function sitemap(): MetadataRoute.Sitemap {
	const base = env.NEXT_PUBLIC_MARKETING_URL ?? "https://fuutustack.com";
	const now = new Date();

	const entries: MetadataRoute.Sitemap = [];

	for (const path of STATIC_ROUTES) {
		entries.push(
			...entriesFor(base, {
				path,
				kind: "page",
				lastModified: now,
				changeFrequency: "weekly",
				priority: path === "" ? 1 : 0.7,
			}),
		);
	}
	for (const path of LEGAL_ROUTES) {
		entries.push(
			...entriesFor(base, {
				path,
				kind: "legal",
				lastModified: now,
				changeFrequency: "weekly",
				priority: 0.7,
			}),
		);
	}

	const visiblePosts = posts.filter((p) => !p.frontmatter.draft);
	for (const post of visiblePosts) {
		entries.push(
			...entriesFor(base, {
				path: `/blog/${post.slug}`,
				kind: "blog",
				lastModified: new Date(post.frontmatter.publishedAt),
				changeFrequency: "monthly",
				priority: 0.6,
			}),
		);
	}

	// Changelog: no per-version entries — hash-fragment URLs are ignored by
	// crawlers. The /changelog index is already covered by STATIC_ROUTES.

	// App pages (`appMarketing.sitemapRoutes`), after the kit routes.
	const { sitemapRoutes } = appMarketing;
	const appRoutes =
		typeof sitemapRoutes === "function" ? sitemapRoutes() : sitemapRoutes;
	const listed = new Set([
		...STATIC_ROUTES,
		...LEGAL_ROUTES,
		...visiblePosts.map((post) => `/blog/${post.slug}`),
	]);
	for (const route of appRoutes ?? []) {
		if (listed.has(route.path)) {
			throw new Error(
				`appMarketing.sitemapRoutes: duplicate sitemap path "${route.path}"`,
			);
		}
		listed.add(route.path);
		entries.push(
			...entriesFor(base, {
				path: route.path,
				kind: route.kind ?? "page",
				lastModified: route.lastModified ?? now,
				changeFrequency: route.changeFrequency ?? "weekly",
				priority: route.priority ?? 0.7,
			}),
		);
	}

	return entries;
}
