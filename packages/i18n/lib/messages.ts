import deepmerge from "deepmerge";
import { i18nConfig } from "../config";
import type { Messages } from "../types";

export type AppName = "marketing" | "saas" | "docs";

const VALID_LOCALES = Object.keys(i18nConfig.locales);

const namespaceLoaders: Record<
	string,
	Record<string, () => Promise<Record<string, unknown>>>
> = {
	en: {
		common: async () =>
			(await import("../translations/en/common/index")).default,
		marketing: async () =>
			(await import("../translations/en/marketing/index")).default,
		saas: async () => (await import("../translations/en/saas/index")).default,
		docs: async () => (await import("../translations/en/docs/index")).default,
	},
	de: {
		common: async () =>
			(await import("../translations/de/common/index")).default,
		marketing: async () =>
			(await import("../translations/de/marketing/index")).default,
		saas: async () => (await import("../translations/de/saas/index")).default,
		docs: async () => (await import("../translations/de/docs/index")).default,
	},
};

const loadNamespace = async (
	locale: string,
	app: string,
): Promise<Record<string, unknown>> => {
	const loaders =
		namespaceLoaders[locale] ?? namespaceLoaders[i18nConfig.defaultLocale];
	const loader = loaders?.[app];
	if (!loader) return {};
	return loader();
};

export const importLocale = async (
	locale: string,
	app?: AppName,
): Promise<Messages> => {
	const effectiveLocale = VALID_LOCALES.includes(locale)
		? locale
		: i18nConfig.defaultLocale;

	const common = await loadNamespace(effectiveLocale, "common");
	if (!app) {
		const marketing = await loadNamespace(effectiveLocale, "marketing");
		const saas = await loadNamespace(effectiveLocale, "saas");
		const docs = await loadNamespace(effectiveLocale, "docs");
		return { ...common, ...marketing, ...saas, ...docs } as Messages;
	}
	const appMessages = await loadNamespace(effectiveLocale, app);
	return { ...common, ...appMessages } as Messages;
};

const getFallbackChain = (locale: string): string[] => {
	const chain: string[] = [locale];
	const localeConfig =
		i18nConfig.locales[locale as keyof typeof i18nConfig.locales];

	if (
		localeConfig &&
		"fallbackLocale" in localeConfig &&
		localeConfig.fallbackLocale
	) {
		const fallback = localeConfig.fallbackLocale;
		if (fallback !== locale && !chain.includes(fallback)) {
			chain.push(...getFallbackChain(fallback));
		}
	}

	if (!chain.includes(i18nConfig.defaultLocale)) {
		chain.push(i18nConfig.defaultLocale);
	}

	return chain;
};

export const getMessagesForLocale = async (
	locale: string,
	app?: AppName,
): Promise<Messages> => {
	const fallbackChain = getFallbackChain(locale);

	if (fallbackChain.length === 1) {
		return await importLocale(locale, app);
	}

	const messages = await Promise.all(
		fallbackChain.reverse().map((loc) => importLocale(loc, app)),
	);

	// Arrays are replacements, not concatenations — prevents duplicate React keys and double-rendering when merging fallback chains.
	return messages.reduce(
		(acc, curr) =>
			deepmerge(acc, curr, { arrayMerge: (_target, source) => source }),
		{} as Messages,
	);
};
