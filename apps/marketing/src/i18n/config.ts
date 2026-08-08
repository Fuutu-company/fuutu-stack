import { getAllLocales, type Locale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";

export const locales = getAllLocales();
export const defaultLocale: Locale = i18nConfig.defaultLocale;
