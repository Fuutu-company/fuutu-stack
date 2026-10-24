import deepmerge from "deepmerge";
import { i18nConfig } from "../config";
import type { Locale, Messages } from "../types";
import { isValidLocale } from "./locale-utils";

export type AppName = "marketing" | "saas" | "docs";
type Namespace = "common" | AppName;
type NamespaceLoader = () => Promise<Record<string, unknown>>;

// Keyed by `Locale` — adding a locale to i18nConfig.locales without a
// matching entry here fails type-checking.
const namespaceLoaders: Record<Locale, Record<Namespace, NamespaceLoader>> = {
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
	locale: Locale,
	app: Namespace,
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
	const effectiveLocale: Locale = isValidLocale(locale)
		? locale
		: i18nConfig.defaultLocale;

	const common = await loadNamespace(effectiveLocale, "common");
	if (!app) {
		const marketing = await loadNamespace(effectiveLocale, "marketing");
		const saas = await loadNamespace(effectiveLocale, "saas");
		const docs = await loadNamespace(effectiveLocale, "docs");
		// `docs` stays nested — its `nav`/`home` namespaces would shadow
		// marketing's if shallow-spread (mirrors `translations/*/index.ts`).
		return { ...common, ...marketing, ...saas, docs } as Messages;
	}
	const appMessages = await loadNamespace(effectiveLocale, app);
	return { ...common, ...appMessages } as Messages;
};

export type FallbackChainConfig = {
	// Index signature keeps the entry non-weak — locales without a
	// `fallbackLocale` property (e.g. the default locale) stay assignable.
	readonly locales: Record<
		string,
		{ readonly fallbackLocale?: string; [key: string]: unknown }
	>;
	readonly defaultLocale: string;
};

/**
 * Resolution order: the locale itself, then its configured `fallbackLocale`
 * (recursively), then its nearest configured BCP-47 parent when no
 * `fallbackLocale` is configured ("de-AT" → "de"), and always `defaultLocale`
 * last. The `visited` set carries the accumulated chain through recursion so
 * configured fallback cycles (a → b → a) terminate instead of overflowing
 * the stack. `defaultLocale` is appended by the outermost call only —
 * inner frames must not re-append it, or a `defaultLocale` that also sits
 * inside the chain (e.g. defaultLocale "de" with de → en) would duplicate
 * and invert merge priority downstream.
 */
export const getFallbackChain = (
	locale: string,
	config: FallbackChainConfig = i18nConfig,
	visited: ReadonlySet<string> = new Set(),
): string[] => {
	const chain: string[] = [locale];
	const seen = new Set(visited).add(locale);

	let fallback = config.locales[locale]?.fallbackLocale;
	if (!fallback) {
		// Walk BCP-47 subtags up to the nearest configured parent
		// ("de-AT-x" → "de-AT" → "de"), skipping unconfigured intermediates.
		let candidate = locale;
		let separator = candidate.lastIndexOf("-");
		while (separator > 0) {
			candidate = candidate.slice(0, separator);
			if (Object.hasOwn(config.locales, candidate)) {
				fallback = candidate;
				break;
			}
			separator = candidate.lastIndexOf("-");
		}
	}

	if (fallback && !seen.has(fallback)) {
		chain.push(...getFallbackChain(fallback, config, seen));
	}

	if (visited.size === 0 && !chain.includes(config.defaultLocale)) {
		chain.push(config.defaultLocale);
	}

	return chain;
};

export const getMessagesForLocale = async (
	locale: string,
	app?: AppName,
): Promise<Messages> => {
	// Load order: lowest priority first so the requested locale merges last.
	// Unconfigured locales (e.g. "fr") resolve to the default bundle inside
	// importLocale — dedupe on the resolved locale so each bundle is
	// imported exactly once.
	const loadOrder = [
		...new Set(
			getFallbackChain(locale)
				.reverse()
				.map((loc) => (isValidLocale(loc) ? loc : i18nConfig.defaultLocale)),
		),
	];

	if (loadOrder.length === 1) {
		return await importLocale(loadOrder[0] ?? i18nConfig.defaultLocale, app);
	}

	const messages = await Promise.all(
		loadOrder.map((loc) => importLocale(loc, app)),
	);

	// Arrays are replacements, not concatenations — prevents duplicate React keys and double-rendering when merging fallback chains.
	return messages.reduce(
		(acc, curr) =>
			deepmerge(acc, curr, { arrayMerge: (_target, source) => source }),
		{} as Messages,
	);
};
