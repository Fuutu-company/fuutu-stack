"use client";

import type { Locale, Messages } from "@fuutu/i18n";
import { getDirection, importLocale, isValidLocale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import { NextIntlClientProvider } from "next-intl";
import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

const STORAGE_KEY = "desktop.locale";

type LocaleState = { locale: Locale; setLocale: (locale: Locale) => void };

const LocaleContext = createContext<LocaleState | null>(null);

export function useDesktopLocale(): LocaleState {
	const value = useContext(LocaleContext);
	if (!value) throw new Error("useDesktopLocale outside DesktopIntlProvider");
	return value;
}

function initialLocale(): Locale {
	const fallback = i18nConfig.defaultLocale as Locale;
	if (typeof window === "undefined") return fallback;
	try {
		const stored = window.localStorage.getItem(STORAGE_KEY);
		if (stored && isValidLocale(stored)) return stored as Locale;
	} catch {
		// storage unavailable — use the default
	}
	const system = window.navigator.language.split("-")[0] ?? "";
	return isValidLocale(system) ? (system as Locale) : fallback;
}

/**
 * next-intl without i18n routing: the locale is client state (persisted),
 * messages are the bundled `desktop` + `common` namespaces, switched at
 * runtime without a reload.
 */
export function DesktopIntlProvider({ children }: PropsWithChildren) {
	const [locale, setLocaleState] = useState<Locale>(
		i18nConfig.defaultLocale as Locale,
	);
	const [messages, setMessages] = useState<Messages | null>(null);

	useEffect(() => {
		setLocaleState(initialLocale());
	}, []);

	useEffect(() => {
		let cancelled = false;
		void importLocale(locale, "desktop").then((loaded) => {
			if (!cancelled) setMessages(loaded);
		});
		document.documentElement.lang = locale;
		document.documentElement.dir = getDirection(locale);
		return () => {
			cancelled = true;
		};
	}, [locale]);

	const setLocale = useCallback((next: Locale) => {
		setLocaleState(next);
		try {
			window.localStorage.setItem(STORAGE_KEY, next);
		} catch {
			// storage unavailable — the choice lasts for this session
		}
	}, []);

	if (!messages) return null;

	return (
		<LocaleContext.Provider value={{ locale, setLocale }}>
			<NextIntlClientProvider
				locale={locale}
				messages={messages}
				timeZone={Intl.DateTimeFormat().resolvedOptions().timeZone}
			>
				{children}
			</NextIntlClientProvider>
		</LocaleContext.Provider>
	);
}
