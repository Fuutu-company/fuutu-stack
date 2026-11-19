import { legal, posts } from "@fuutu/content";
import { env } from "@fuutu/env/marketing";
import { getRoutableLocales } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import type { MetadataRoute } from "next";
import { appMarketing } from "@/app-marketing";
import type { SitemapRoute } from "@/lib/extensions";
import { isKitPathEnabled } from "../lib/kit-routes";
import { localeUrl } from "../lib/locale-url";
import { definedFields } from "../lib/page-metadata";

const KIT_STATIC_ROUTES = ["", "/pricing", "/blog", "/changelog", "/contact"];

const LEGAL_ROUTES = [...new Set(legal.map((doc) => doc.slug))].map(
	(slug) => `/legal/${slug}`,
);

/**
 * One entry per (path, routable locale): every enabled locale with hreflang
 * alternates, or only the unprefixed default locale while i18n is disabled.
 * `appMarketing.sitemapExclude` may drop entries, `appMarketing.sitemap`
 * override the kit's per-entry values.
 */
function entriesFor(
	base: string,
	route: Omit<SitemapRoute, "locale">,
): MetadataRoute.Sitemap {
	const { sitemapExclude } = appMarketing;
	const locales = getRoutableLocales().filter(
		(locale) => !sitemapExclude?.({ ...route, locale }),
	);
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
	// Pages the app switched off (`appKitRoutes`) are not listed.
	const staticRoutes = KIT_STATIC_ROUTES.filter(isKitPathEnabled);
	const base = env.NEXT_PUBLIC_MARKETING_URL ?? "https://fuutustack.com";
	const now = new Date();

	const entries: MetadataRoute.Sitemap = [];

	for (const path of staticRoutes) {
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

	const visiblePosts = posts.filter(
		(p) => !p.frontmatter.draft && isKitPathEnabled(`/blog/${p.slug}`),
	);
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
	// crawlers. The /changelog index is already covered by the static routes.

	// App pages (`appMarketing.sitemapRoutes`), after the kit routes.
	const { sitemapRoutes } = appMarketing;
	const appRoutes =
		typeof sitemapRoutes === "function" ? sitemapRoutes() : sitemapRoutes;
	const listed = new Set([
		...staticRoutes,
		...LEGAL_ROUTES,
		...visiblePosts.map((post) => `/blog/${post.slug}`),
	]);
	for (const route of appRoutes ?? []) {
		// A switched-off kit path answers 404 — never list it.
		if (!isKitPathEnabled(route.path)) continue;
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
