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

function getCookieDomain(): string | undefined {
	if (typeof window === "undefined") return undefined;
	const hostname = window.location.hostname;
	// localhost: cookies are shared across ports without explicit domain
	if (hostname === "localhost" || hostname === "127.0.0.1") return undefined;
	// production: set on parent domain so it's shared across subdomains
	const parts = hostname.split(".");
	if (parts.length >= 2) return `.${parts.slice(-2).join(".")}`;
	return undefined;
}

export function readConsentCookie(): string | null {
	if (typeof document === "undefined") return null;
	const name = `${analyticsConfig.consentCookieName}=`;
	const decoded = decodeURIComponent(document.cookie);
	const found = decoded
		.split(";")
		.map((c) => c.trim())
		.find((c) => c.startsWith(name));
	return found ? found.substring(name.length) : null;
}

function writeConsentCookie(value: "granted" | "denied") {
	if (typeof document === "undefined") return;
	const domain = getCookieDomain();
	const parts = [
		`${analyticsConfig.consentCookieName}=${value}`,
		`max-age=${analyticsConfig.consentCookieMaxAge}`,
		"path=/",
		"SameSite=Lax",
	];
	if (domain) {
		parts.push(`domain=${domain}`);
		parts.push("Secure");
	}
	document.cookie = parts.join("; ");
}

/**
 * Holds the user's analytics-consent decision. Reads/writes a cookie
 * so the choice survives reloads and is shared across subdomains
 * (e.g. stack.fuutu.com → stackapp.fuutu.com). Emits a
 * `fuutu:consent` window event so <AnalyticsScript /> can react.
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
 * Minimal, unstyled DSGVO banner. Apps can replace this with their
 * own UI by reading `useConsent()` directly. Hidden once the user
 * has made a decision, or when consent is not required.
 */
export function ConsentBanner() {
	const t = useTranslations("consent");
	const { status, hydrated, grant, deny } = useConsent();

	if (!analyticsConfig.requireConsent) return null;
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
