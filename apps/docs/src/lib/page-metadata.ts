import { getRoutableLocales } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import type { Metadata } from "next";

/** Docs page metadata options — `appDocs.metadata` (`src/app-docs.tsx`). */
export interface DocsMetadataOptions {
	/**
	 * `<title>` of every docs page, `%s` = the page title (e.g.
	 * `"%s · Acme Docs"`). Open Graph / Twitter titles stay the page title.
	 */
	titleTemplate?: string;
	/**
	 * Absolute origin for `<link rel="canonical">` on docs pages (e.g.
	 * `"https://docs.acme.dev"`); the page's locale path is appended.
	 * Unset: no canonical link.
	 */
	canonicalBase?: string;
}

/** Path of a locale-free docs path in a locale (`as-needed` prefix). */
function localePath(locale: string, path: string): string {
	if (locale === i18nConfig.defaultLocale) return path || "/";
	return `/${locale}${path}`;
}

/**
 * hreflang map for a locale-free path (`""` = docs home) — every routable
 * locale; `undefined` while i18n is disabled (no locale has its own URL).
 */
export function hreflangLanguages(
	path: string,
): Record<string, string> | undefined {
	if (!i18nConfig.enabled) return undefined;
	return Object.fromEntries(
		getRoutableLocales().map((locale) => [locale, localePath(locale, path)]),
	);
}

/** Metadata of one docs page; without options the kit's. */
export function docsPageMetadata(
	page: {
		title?: string;
		description?: string;
		locale: string;
		/** Locale-free path, e.g. `/docs/guides/theming`. */
		path: string;
		image: string;
	},
	options: DocsMetadataOptions | undefined,
): Metadata {
	const languages = hreflangLanguages(page.path);
	const canonical = options?.canonicalBase
		? `${options.canonicalBase.replace(/\/+$/, "")}${localePath(page.locale, page.path)}`
		: undefined;
	const alternates =
		canonical || languages
			? {
					...(canonical ? { canonical } : {}),
					...(languages ? { languages } : {}),
				}
			: undefined;

	return {
		title:
			options?.titleTemplate && page.title !== undefined
				? options.titleTemplate.replaceAll("%s", page.title)
				: page.title,
		description: page.description,
		...(alternates ? { alternates } : {}),
		openGraph: {
			title: page.title,
			description: page.description,
			locale: page.locale,
			images: page.image,
		},
		twitter: {
			card: "summary_large_image",
			title: page.title,
			description: page.description,
		},
	};
}
