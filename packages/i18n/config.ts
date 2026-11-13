/**
 * i18n configuration — owned by @fuutu/i18n.
 *
 * Enable / disable a language: add or remove its entry in `locales` below —
 * nothing else. Every app (saas, marketing, docs, mail) derives its routes,
 * switchers, sitemaps and static params from this object, and
 * `pnpm check-translations` checks parity across the enabled locales only.
 * With a single entry the language switchers hide themselves.
 *
 * A removed locale is "dormant": keep its `translations/<code>/` folder, its
 * `namespaceLoaders` entry (`lib/messages.ts`), its mail strings
 * (`packages/mail/src/i18n.ts`) and its flag in the switchers. Stored user
 * preferences for it still resolve, it is just no longer routable.
 * Re-enable by adding the entry back (set `fallbackLocale` for a chain).
 * `defaultLocale` must stay an enabled locale.
 *
 * To add a brand-new locale:
 *   1. Create a folder `translations/<code>/` mirroring `en/` (common/, marketing/, saas/ with index.ts)
 *   2. Add an entry to `locales` below
 *   3. Add loader entries to `namespaceLoaders` in `lib/messages.ts` (compile-enforced — it is keyed by Locale)
 *   4. Add its mail strings in `packages/mail/src/i18n.ts` and a flag in the three locale switchers (compile-enforced)
 *   5. Optionally set `fallbackLocale` for per-locale fallback chains
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
