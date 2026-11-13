import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { i18nConfig } from "../../../packages/i18n/config";

/** Enabled locales — the single source is `i18nConfig.locales`. */
export const LOCALES: readonly string[] = Object.keys(i18nConfig.locales);
export const DEFAULT_LOCALE: string = i18nConfig.defaultLocale;
export const OTHER_LOCALES: readonly string[] = LOCALES.filter(
	(locale) => locale !== DEFAULT_LOCALE,
);

/** Display label of a locale (what the locale switcher shows). */
export const localeLabel = (locale: string): string =>
	(i18nConfig.locales as Record<string, { label: string }>)[locale]?.label ??
	locale;

/** URL prefix for a locale — the default locale is served unprefixed. */
export const localePrefix = (locale: string): string =>
	locale === DEFAULT_LOCALE ? "" : `/${locale}`;

/** Marketing home messages of a locale, read from its translation bundle. */
export function readHomeMessages(locale: string): {
	home: { hero: { screenshotAlt: string } };
} {
	const file = resolve(
		__dirname,
		`../../../packages/i18n/translations/${locale}/marketing/home.json`,
	);
	return JSON.parse(readFileSync(file, "utf-8"));
}
