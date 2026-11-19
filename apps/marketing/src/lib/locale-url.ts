import { getRoutableLocales } from "@fuutu/i18n";
import { defaultLocale } from "../i18n/config";

/**
 * Build a locale-prefixed URL. The marketing app uses
 * `localePrefix: "as-needed"` — i.e. the default locale is served
 * without prefix and every other locale lives under `/<locale>/...`.
 * `base` is an origin (sitemap) or `""` for a relative path.
 */
export function localeUrl(base: string, locale: string, path: string): string {
	if (locale === defaultLocale) return `${base}${path}`;
	return `${base}/${locale}${path}`;
}

/**
 * hreflang map for a page path (`""` = home): one relative URL per routable
 * locale — every enabled locale, or only the default while i18n is off —
 * plus `x-default` pointing at the default-locale URL. Relative values;
 * `metadataBase` makes them absolute.
 */
export function languageAlternates(path: string): Record<string, string> {
	const languages: Record<string, string> = {};
	for (const locale of getRoutableLocales()) {
		languages[locale] = localeUrl("", locale, path) || "/";
	}
	languages["x-default"] = localeUrl("", defaultLocale, path) || "/";
	return languages;
}
