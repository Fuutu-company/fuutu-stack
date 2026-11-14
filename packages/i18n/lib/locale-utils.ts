import { i18nConfig } from "../config";
import type { Locale } from "../types";

export const getLocaleConfig = (locale: Locale) => {
	return i18nConfig.locales[locale];
};

export const getDateFormat = (locale: Locale): string => {
	return i18nConfig.locales[locale].dateFormat;
};

export const getDirection = (locale: Locale): "ltr" | "rtl" => {
	return i18nConfig.locales[locale].direction;
};

export const getCurrency = (locale: Locale): string => {
	return i18nConfig.locales[locale].currency;
};

export const getAllLocales = (): Locale[] => {
	return Object.keys(i18nConfig.locales) as Locale[];
};

/**
 * Locales served under their own URL — every enabled locale, or only the
 * default one while `i18nConfig.enabled` is false (the apps then route
 * without a locale prefix). Sitemaps and hreflang alternates use this.
 */
export const getRoutableLocales = (): Locale[] =>
	i18nConfig.enabled ? getAllLocales() : [i18nConfig.defaultLocale];

/** False when only one locale is enabled — language switchers hide themselves. */
export const hasMultipleLocales = (): boolean => getAllLocales().length > 1;

export const isValidLocale = (locale: string): locale is Locale => {
	return Object.hasOwn(i18nConfig.locales, locale);
};
