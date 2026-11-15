"use client";

import { Button } from "@fuutu/ui";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { analyticsConfig } from "./config";
import {
	type ConsentCookieValue,
	readConsentCookie,
	writeConsentCookie,
} from "./consent-cookie";
import {
	type ConsentBannerMode,
	consentBannerMode,
	consentBannerVisible,
	consentDecisionNeeded,
} from "./index";

export { readConsentCookie } from "./consent-cookie";

type ConsentStatus = "unknown" | ConsentCookieValue;

interface ConsentContextValue {
	status: ConsentStatus;
	/** `"consent"` (Accept / Decline) or `"notice"` (OK / Opt out). */
	mode: ConsentBannerMode;
	/**
	 * `true` once the client has read the consent cookie. Used to suppress
	 * the SSR → client flash of the banner on reload after the user
	 * already made a choice.
	 */
	hydrated: boolean;
	/** Whether the banner is on screen: no decision yet, or reopened. */
	open: boolean;
	grant: () => void;
	deny: () => void;
	/** The OK on the notice banner — tracking continues, no consent stored. */
	acknowledge: () => void;
	/** Show the banner again ("Privacy settings"), in either mode. */
	reopen: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

const OPEN_EVENT = `${analyticsConfig.consentEventName}:open`;

function dispatch(name: string) {
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent(name));
	}
}

function readStatus(): ConsentStatus {
	const value = readConsentCookie();
	return value === "granted" || value === "denied" || value === "acknowledged"
		? value
		: "unknown";
}

/**
 * Reopen the consent banner from anywhere (a footer link, a settings
 * page). Window event, so it reaches the provider that renders the banner
 * even from inside a nested <ConsentProvider>.
 */
export function openConsentBanner() {
	dispatch(OPEN_EVENT);
}

/**
 * Holds the user's analytics-consent decision. Reads/writes a cookie
 * (host-scoped by default, cross-subdomain opt-in via
 * `analyticsConfig.consentCookieDomain`) so the choice survives reloads
 * and — with a shared domain — sibling apps. Emits a `fuutu:consent`
 * window event so <AnalyticsScript /> and nested providers react.
 */
export function ConsentProvider({ children }: { children: ReactNode }) {
	const [status, setStatus] = useState<ConsentStatus>("unknown");
	const [hydrated, setHydrated] = useState(false);
	const [reopened, setReopened] = useState(false);

	useEffect(() => {
		setStatus(readStatus());
		setHydrated(true);
		const onChange = () => {
			setStatus(readStatus());
			setReopened(false);
		};
		const onOpen = () => setReopened(true);
		window.addEventListener(analyticsConfig.consentEventName, onChange);
		window.addEventListener(OPEN_EVENT, onOpen);
		return () => {
			window.removeEventListener(analyticsConfig.consentEventName, onChange);
			window.removeEventListener(OPEN_EVENT, onOpen);
		};
	}, []);

	const decide = useCallback((value: ConsentCookieValue) => {
		writeConsentCookie(value);
		setStatus(value);
		setReopened(false);
		dispatch(analyticsConfig.consentEventName);
	}, []);
	const grant = useCallback(() => decide("granted"), [decide]);
	const deny = useCallback(() => decide("denied"), [decide]);
	const acknowledge = useCallback(() => decide("acknowledged"), [decide]);

	const open =
		hydrated &&
		consentBannerVisible() &&
		(reopened || consentDecisionNeeded(status === "unknown" ? null : status));

	return (
		<ConsentContext.Provider
			value={{
				status,
				mode: consentBannerMode(),
				hydrated,
				open,
				grant,
				deny,
				acknowledge,
				reopen: openConsentBanner,
			}}
		>
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
 * "Privacy settings" button — reopens the banner. Renders nothing while
 * the banner is switched off (`consentBannerVisible()`), so footers can
 * mount it unconditionally. Needs a <ConsentProvider> above it.
 */
export function PrivacySettingsButton({ className }: { className?: string }) {
	const t = useTranslations("consent");
	if (!consentBannerVisible()) return null;
	return (
		<button type="button" className={className} onClick={openConsentBanner}>
			{t("privacySettings")}
		</button>
	);
}

/**
 * The banner's Privacy Policy link. Renders nothing without `href`, so an
 * app that has no privacy page simply passes none.
 */
export function ConsentPrivacyLink({
	href,
	label,
}: {
	href: string | undefined;
	label: string;
}) {
	if (!href) return null;
	return (
		<a
			href={href}
			className="text-foreground underline underline-offset-4 hover:no-underline"
		>
			{label}
		</a>
	);
}

/**
 * Minimal GDPR banner. Apps can replace this with their own UI by
 * reading `useConsent()` directly. Two modes (`consentBannerMode()`):
 * `"consent"` asks before tracking (Accept / Decline), `"notice"` tells
 * the user that cookieless analytics already run (OK / Opt out). Hidden
 * once the user has decided — until reopened via `openConsentBanner()` —
 * or when the banner is switched off (`consentBannerVisible()`).
 * `privacyHref`: URL of the privacy policy, linked inside the banner —
 * unset, no link.
 */
export function ConsentBanner({ privacyHref }: { privacyHref?: string } = {}) {
	const t = useTranslations("consent");
	// `open` waits for the client-side cookie read — otherwise the banner
	// flashes on reload for users who already decided.
	const { mode, open: visible, grant, deny, acknowledge } = useConsent();
	const bannerRef = useRef<HTMLDivElement>(null);
	const spacerRef = useRef<HTMLDivElement>(null);
	const pathname = usePathname();
	const [reservedPx, setReservedPx] = useState(0);

	// The banner floats over the bottom of the viewport. Reserve that strip
	// while it is shown: `scroll-padding-bottom` keeps focused / scrolled-to
	// elements (plan CTAs, form fields) above it, and the spacer below lets
	// the end of the page scroll clear of it. Pages that fit the viewport get
	// no spacer: it would only add blank scroll room that disappears again
	// once consent is given. The banner lives in the layout and survives
	// client-side navigation, so the decision is redone whenever the page
	// changes size (new route, late-loading content) or the route changes.
	// biome-ignore lint/correctness/useExhaustiveDependencies: `pathname` only re-runs the measurement after a client-side navigation.
	useEffect(() => {
		const el = bannerRef.current;
		if (!visible || !el) return;
		const root = document.documentElement;
		const update = () => {
			// +1: layouts with fractional heights round `scrollHeight` down, so
			// a spacer of exactly the banner height leaves up to 1px of the page
			// end unscrollable under the banner.
			const px = Math.max(
				0,
				Math.ceil(window.innerHeight - el.getBoundingClientRect().top) + 1,
			);
			const pageHeight =
				root.scrollHeight - (spacerRef.current?.offsetHeight ?? 0);
			setReservedPx(pageHeight > window.innerHeight ? px : 0);
			root.style.scrollPaddingBottom = `${px}px`;
		};
		update();
		// The spacer's own height changes body/html too; `update` subtracts
		// it, so the follow-up call settles on the same value.
		const observer = new ResizeObserver(update);
		observer.observe(el);
		observer.observe(document.body);
		observer.observe(root);
		window.addEventListener("resize", update);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", update);
			root.style.scrollPaddingBottom = "";
		};
	}, [visible, pathname]);

	if (!visible) return null;

	return (
		<>
			<div ref={spacerRef} aria-hidden="true" style={{ height: reservedPx }} />
			<div
				ref={bannerRef}
				role="dialog"
				aria-label={mode === "notice" ? t("notice.label") : t("title")}
				className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border bg-background p-4 shadow-lg sm:flex-row sm:items-center sm:gap-4"
			>
				{mode === "notice" ? (
					<p className="flex-1 text-sm">
						{t("notice.description")}{" "}
						<ConsentPrivacyLink href={privacyHref} label={t("privacyPolicy")} />
					</p>
				) : (
					<div className="flex-1 text-sm">
						<p className="font-medium">{t("title")}</p>
						<p className="text-muted-foreground">
							{t("description")}{" "}
							<ConsentPrivacyLink
								href={privacyHref}
								label={t("privacyPolicy")}
							/>
						</p>
					</div>
				)}
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" onClick={deny}>
						{mode === "notice" ? t("notice.optOut") : t("deny")}
					</Button>
					<Button
						type="button"
						size="sm"
						onClick={mode === "notice" ? acknowledge : grant}
					>
						{mode === "notice" ? t("notice.ok") : t("accept")}
					</Button>
				</div>
			</div>
		</>
	);
}
