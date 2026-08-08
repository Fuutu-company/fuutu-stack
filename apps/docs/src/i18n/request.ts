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
	let locale = (await requestLocale) as Locale | undefined;

	if (!locale) {
		locale = await getUserLocale();
	}

	if (
		!(Object.keys(i18nConfig.locales).includes(locale) && i18nConfig.enabled)
	) {
		locale = i18nConfig.defaultLocale as Locale;
	}

	const messages = await getMessagesForLocale(locale, "docs");

	return {
		locale,
		messages,
	};
});
