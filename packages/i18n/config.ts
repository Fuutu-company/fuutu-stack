/**
 * i18n configuration — owned by @fuutu/i18n.
 *
 * To add a locale:
 *   1. Create a folder `translations/<code>/` mirroring `en/` (common/, marketing/, saas/ with index.ts)
 *   2. Add an entry to `locales` below
 *   3. Optionally set `fallbackLocale` for per-locale fallback chains
 */
export const i18nConfig = {
	enabled: true,
	locales: {
		en: {
			currency: "USD",
			label: "English",
			dateFormat: "MM/DD/YYYY",
			direction: "ltr",
		},
		de: {
			currency: "EUR",
			label: "Deutsch",
			dateFormat: "DD.MM.YYYY",
			direction: "ltr",
			fallbackLocale: "en",
		},
	},
	defaultLocale: "en",
	defaultCurrency: "USD",
	localeCookieName: "NEXT_LOCALE",
} as const;

export type I18nConfig = typeof i18nConfig;
export type LocaleConfig =
	(typeof i18nConfig.locales)[keyof typeof i18nConfig.locales];
