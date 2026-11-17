import { env } from "@fuutu/env/marketing";
import type { AnalyticsProviderId } from "./types";

export interface AnalyticsConfig {
	provider: AnalyticsProviderId;
	/** Website / property identifier (Umami: websiteId, Plausible: domain, GA4: measurementId, …). */
	websiteId?: string;
	/**
	 * Optional self-hosted script URL (Umami / Plausible). Self-hosted
	 * Umami needs v2.18.0+ for the opt-out to stop auto-tracking
	 * (`data-before-send`).
	 */
	scriptUrl?: string;
	/**
	 * Consent override. `true` forces the tracking gate for every
	 * provider; `false` disables the consent requirement entirely.
	 * Leave unset to let the active provider decide via its
	 * `requiresConsent` flag.
	 */
	requireConsent?: boolean;
	/**
	 * Banner override. `true` shows the consent banner even for
	 * consent-free providers (transparency), `false` hides it.
	 * Leave unset to let the active provider decide via its
	 * `showConsentBanner` flag. Has no effect while the tracking
	 * gate is active — a consent-required provider always shows
	 * the banner.
	 */
	showConsentBanner?: boolean;
	/** Cookie name for the consent decision. */
	consentCookieName: string;
	/**
	 * Optional parent domain for the consent cookie (e.g. `.example.com`)
	 * to share the decision across subdomains — set this when marketing,
	 * SaaS and docs run on subdomains of one parent domain. Leave unset
	 * to scope the cookie to the current host — safe on public-suffix
	 * domains (`.co.uk` & friends) where a derived domain would be
	 * rejected.
	 */
	consentCookieDomain?: string;
	/** Cookie max-age in seconds (default: 1 year). */
	consentCookieMaxAge: number;
	/** Window event name dispatched when the consent decision changes. */
	consentEventName: string;
	/**
	 * Query params stripped (case-insensitive) from every page and
	 * referrer URL before it is sent — auth links carry tokens, emails
	 * and ids there. Remove a name only if no page puts a secret in it.
	 */
	redactedQueryParams: readonly string[];
}

export const analyticsConfig: AnalyticsConfig = {
	provider: env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "umami",
	websiteId: env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
	scriptUrl: env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
	requireConsent: env.NEXT_PUBLIC_ANALYTICS_REQUIRE_CONSENT,
	showConsentBanner: env.NEXT_PUBLIC_ANALYTICS_SHOW_CONSENT_BANNER,
	consentCookieDomain: env.NEXT_PUBLIC_ANALYTICS_CONSENT_DOMAIN,
	consentCookieName: "fuutu.consent.v1",
	consentCookieMaxAge: 31_536_000,
	consentEventName: "fuutu:consent",
	redactedQueryParams: ["token", "email", "id", "code", "sig", "state"],
};
