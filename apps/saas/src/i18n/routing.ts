import { i18nConfig } from "@fuutu/i18n/config";
import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

// SaaS app uses cookie-based locale (no URL prefix).
export const routing = defineRouting({
	locales,
	defaultLocale,
	localePrefix: "never",
	localeCookie: {
		name: i18nConfig.localeCookieName,
	},
	localeDetection: false,
});
