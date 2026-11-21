import deepmerge from "deepmerge";
import { i18nConfig } from "../config";
import type { AppTranslations, Locale, Messages } from "../types";

export type AppName = "marketing" | "saas" | "docs" | "desktop";
type Namespace = "common" | AppName;
type NamespaceLoader = () => Promise<Record<string, unknown>>;
type LocaleLoaders = Record<Exclude<Namespace, "desktop">, NamespaceLoader> & {
	// Desktop app bundle (`translations/<locale>/desktop/`) — optional so a
	// locale wired in without it (or a repo without apps/desktop) still works.
	desktop?: NamespaceLoader;
	// App-owned overlay (`translations/<locale>/app/index.ts`), merged last.
	// Optional: locales wired in without an overlay (dormant) keep working.
	app?: () => Promise<AppTranslations>;
};

// Keyed by `Locale` — adding a locale to i18nConfig.locales without a
// matching entry here fails type-checking. The `Partial<Record<string, …>>`
// arm additionally permits "dormant" locales: bundles wired into the loader
// map without being a configured (routable) locale. Dormant locales resolve
// via `isKnownLocale` / `importLocale` but stay invalid for routing.
export const namespaceLoaders: Record<Locale, LocaleLoaders> &
	Partial<Record<string, LocaleLoaders>> = {
	en: {
		common: async () =>
			(await import("../translations/en/common/index")).default,
		marketing: async () =>
			(await import("../translations/en/marketing/index")).default,
		saas: async () => (await import("../translations/en/saas/index")).default,
		docs: async () => (await import("../translations/en/docs/index")).default,
		desktop: async () =>
			(await import("../translations/en/desktop/index")).default,
		app: async () =>
			(await import("../translations/en/app/index")).appTranslations,
	},
	de: {
		common: async () =>
			(await import("../translations/de/common/index")).default,
		marketing: async () =>
			(await import("../translations/de/marketing/index")).default,
		saas: async () => (await import("../translations/de/saas/index")).default,
		docs: async () => (await import("../translations/de/docs/index")).default,
		desktop: async () =>
			(await import("../translations/de/desktop/index")).default,
		app: async () =>
			(await import("../translations/de/app/index")).appTranslations,
	},
};

/**
 * True when `locale` has translation bundles registered — configured locales
 * plus dormant ones. Use this (not `isValidLocale`) to sanitize stored
 * user-supplied locale tags: dormant-but-real locales survive while garbage
 * tags are still rejected. Routing validity stays `isValidLocale`.
 */
export const isKnownLocale = (locale: string): boolean =>
	Object.hasOwn(namespaceLoaders, locale);

const loadNamespace = async (
	locale: string,
	app: Namespace,
): Promise<Record<string, unknown>> => {
	const loaders =
		namespaceLoaders[locale] ?? namespaceLoaders[i18nConfig.defaultLocale];
	const loader = loaders?.[app];
	if (!loader) return {};
	return loader();
};

const mergeMessages = (
	base: Record<string, unknown>,
	overlay: Record<string, unknown> | undefined,
): Record<string, unknown> =>
	overlay
		? deepmerge(base, overlay, { arrayMerge: (_target, source) => source })
		: base;

const loadAppOverlay = async (locale: string): Promise<AppTranslations> => {
	const loaders =
		namespaceLoaders[locale] ?? namespaceLoaders[i18nConfig.defaultLocale];
	return (await loaders?.app?.()) ?? {};
};

// The desktop namespace is nested under `desktop` in its bundle; the app
// overlay's `desktop` section merges into that nested object.
const loadDesktop = async (
	locale: string,
	overlay: AppTranslations,
): Promise<Record<string, unknown>> => {
	const bundle = await loadNamespace(locale, "desktop");
	return mergeMessages(
		(bundle.desktop as Record<string, unknown> | undefined) ?? {},
		overlay.desktop,
	);
};

export const importLocale = async (
	locale: string,
	app?: AppName,
): Promise<Messages> => {
	// Bundles exist → load them; routing validity is unrelated to message
	// loading, so dormant locales resolve here too.
	const effectiveLocale: string = isKnownLocale(locale)
		? locale
		: i18nConfig.defaultLocale;

	const overlay = await loadAppOverlay(effectiveLocale);
	const common = mergeMessages(
		await loadNamespace(effectiveLocale, "common"),
		overlay.common,
	);
	if (!app) {
		const marketing = mergeMessages(
			await loadNamespace(effectiveLocale, "marketing"),
			overlay.marketing,
		);
		const saas = mergeMessages(
			await loadNamespace(effectiveLocale, "saas"),
			overlay.saas,
		);
		const docs = mergeMessages(
			await loadNamespace(effectiveLocale, "docs"),
			overlay.docs,
		);
		// `docs` stays nested — its `nav`/`home` namespaces would shadow
		// marketing's if shallow-spread (mirrors `translations/*/index.ts`).
		return {
			...common,
			...marketing,
			...saas,
			docs,
			desktop: await loadDesktop(effectiveLocale, overlay),
		} as Messages;
	}
	if (app === "desktop") {
		return {
			...common,
			desktop: await loadDesktop(effectiveLocale, overlay),
		} as Messages;
	}
	const appMessages = mergeMessages(
		await loadNamespace(effectiveLocale, app),
		overlay[app],
	);
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
 * Recursive worker for `getFallbackChain` — the `visited` set carries
 * the accumulated chain through recursion so configured fallback cycles
 * (a → b → a) terminate instead of overflowing the stack.
 */
const buildFallbackChain = (
	locale: string,
	config: FallbackChainConfig,
	visited: ReadonlySet<string>,
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
		chain.push(...buildFallbackChain(fallback, config, seen));
	}

	return chain;
};

/**
 * Resolution order: the locale itself, then its configured `fallbackLocale`
 * (recursively), then its nearest configured BCP-47 parent when no
 * `fallbackLocale` is configured ("de-AT" → "de"), and always `defaultLocale`
 * last. `defaultLocale` is appended by the outermost call only — inner
 * frames must not re-append it, or a `defaultLocale` that also sits
 * inside the chain (e.g. defaultLocale "de" with de → en) would duplicate
 * and invert merge priority downstream.
 */
export const getFallbackChain = (
	locale: string,
	config: FallbackChainConfig = i18nConfig,
): string[] => {
	const chain = buildFallbackChain(locale, config, new Set());
	if (!chain.includes(config.defaultLocale)) {
		chain.push(config.defaultLocale);
	}
	return chain;
};

export const getMessagesForLocale = async (
	locale: string,
	app?: AppName,
): Promise<Messages> => {
	// Load order: lowest priority first so the requested locale merges last.
	// Locales without registered bundles (e.g. "fr") resolve to the default
	// bundle inside importLocale — dedupe on the resolved locale so each
	// bundle is imported exactly once. Dormant locales are known and keep
	// their own bundle in the chain.
	const loadOrder = [
		...new Set(
			getFallbackChain(locale)
				.reverse()
				.map((loc) => (isKnownLocale(loc) ? loc : i18nConfig.defaultLocale)),
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
