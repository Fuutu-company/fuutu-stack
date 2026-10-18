"use client";

import { Button } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { analyticsConfig } from "./config";
import { readConsentCookie, writeConsentCookie } from "./consent-cookie";
import { consentBannerVisible } from "./index";

export { readConsentCookie } from "./consent-cookie";

type ConsentStatus = "unknown" | "granted" | "denied";

interface ConsentContextValue {
	status: ConsentStatus;
	/**
	 * `true` once the client has read the consent cookie. Used to suppress
	 * the SSR → client flash of the banner on reload after the user
	 * already made a choice.
	 */
	hydrated: boolean;
	grant: () => void;
	deny: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function dispatchChange() {
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent(analyticsConfig.consentEventName));
	}
}

/**
 * Holds the user's analytics-consent decision. Reads/writes a cookie
 * (host-scoped by default, cross-subdomain opt-in via
 * `analyticsConfig.consentCookieDomain`) so the choice survives reloads
 * and — with a shared domain — sibling apps. Emits a `fuutu:consent`
 * window event so <AnalyticsScript /> can react.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
	const [status, setStatus] = useState<ConsentStatus>("unknown");
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		const value = readConsentCookie();
		if (value === "granted" || value === "denied") setStatus(value);
		setHydrated(true);
	}, []);

	const grant = useCallback(() => {
		writeConsentCookie("granted");
		setStatus("granted");
		dispatchChange();
	}, []);

	const deny = useCallback(() => {
		writeConsentCookie("denied");
		setStatus("denied");
		dispatchChange();
	}, []);

	return (
		<ConsentContext.Provider value={{ status, hydrated, grant, deny }}>
			{children}
		</ConsentContext.Provider>
	);
}

export function useConsent(): ConsentContextValue {
	const ctx = useContext(ConsentContext);
	if (!ctx) throw new Error("useConsent must be used within <ConsentProvider>");
	return ctx;
}

/**
 * Minimal, unstyled GDPR banner. Apps can replace this with their
 * own UI by reading `useConsent()` directly. Hidden once the user
 * has made a decision, or when the active provider requires no
 * consent and doesn't opt into the transparency banner.
 */
export function ConsentBanner() {
	const t = useTranslations("consent");
	const { status, hydrated, grant, deny } = useConsent();

	if (!consentBannerVisible()) return null;
	// Defer the first paint until we've checked the consent cookie client-side —
	// otherwise the banner flashes on reload for users who already decided.
	if (!hydrated) return null;
	if (status !== "unknown") return null;

	return (
		<div
			role="dialog"
			aria-label={t("title")}
			className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border bg-background p-4 shadow-lg sm:flex-row sm:items-center sm:gap-4"
		>
			<div className="flex-1 text-sm">
				<p className="font-medium">{t("title")}</p>
				<p className="text-muted-foreground">{t("description")}</p>
			</div>
			<div className="flex gap-2">
				<Button type="button" variant="outline" size="sm" onClick={deny}>
					{t("deny")}
				</Button>
				<Button type="button" size="sm" onClick={grant}>
					{t("accept")}
				</Button>
			</div>
		</div>
	);
}
