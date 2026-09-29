import { getMessagesForLocale, type Locale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export async function getUserLocale(): Promise<Locale> {
	const cookieStore = await cookies();
	return (
		(cookieStore.get(i18nConfig.localeCookieName)?.value as Locale) ||
		i18nConfig.defaultLocale
	);
}

export default getRequestConfig(async ({ requestLocale }) => {
	// SaaS routes have no [locale] segment — locale comes from the cookie
	// (set by the language switcher), with requestLocale as a fallback.
	let locale = await getUserLocale();
	const requested = (await requestLocale) as Locale | undefined;
	if (requested) {
		locale = requested;
	}

	if (!locale) {
		locale = await getUserLocale();
	}

	// Validation: fall back to default if the locale is not supported
	if (
		!(Object.keys(i18nConfig.locales).includes(locale) && i18nConfig.enabled)
	) {
		locale = i18nConfig.defaultLocale as Locale;
	}

	const messages = await getMessagesForLocale(locale, "saas");

	return {
		locale,
		messages,
	};
});
