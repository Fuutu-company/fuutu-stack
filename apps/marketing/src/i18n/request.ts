import { getMessagesForLocale, type Locale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export async function getUserLocale(): Promise<Locale> {
	// cookies() throws outside request scope (build-time page-data collection,
	// metadata-image routes) — fall back to the default locale there.
	try {
		const cookieStore = await cookies();
		return (
			(cookieStore.get(i18nConfig.localeCookieName)?.value as Locale) ||
			i18nConfig.defaultLocale
		);
	} catch {
		return i18nConfig.defaultLocale;
	}
}

export default getRequestConfig(async ({ requestLocale }) => {
	// requestLocale comes from the [locale] URL segment; without it (e.g. root
	// not-found), fall back to the locale cookie. Outside request scope
	// (build-time, metadata-image routes) resolving it reads headers() and
	// throws — treat as "no locale".
	let locale: Locale | undefined;
	try {
		locale = (await requestLocale) as Locale | undefined;
	} catch {
		locale = undefined;
	}

	if (!locale) {
		locale = await getUserLocale();
	}

	// Validation: if the locale is not supported, use the default
	if (
		!(Object.keys(i18nConfig.locales).includes(locale) && i18nConfig.enabled)
	) {
		locale = i18nConfig.defaultLocale as Locale;
	}

	const messages = await getMessagesForLocale(locale, "marketing");

	return {
		locale,
		messages,
	};
});
