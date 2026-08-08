import { i18nConfig } from "@fuutu/i18n/config";
import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

export const routing = defineRouting({
	locales,
	defaultLocale,
	localePrefix: i18nConfig.enabled ? "as-needed" : "never",
	localeCookie: {
		name: i18nConfig.localeCookieName,
	},
	localeDetection: i18nConfig.enabled,
});
