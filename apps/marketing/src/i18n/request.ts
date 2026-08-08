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
	// requestLocale comes from URL parameter [locale] for marketing routes
	// For /app and /auth routes, requestLocale is undefined, then we use cookie
	let locale = (await requestLocale) as Locale | undefined;

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
