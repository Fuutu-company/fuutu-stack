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

export const isValidLocale = (locale: string): locale is Locale => {
	return locale in i18nConfig.locales;
};
