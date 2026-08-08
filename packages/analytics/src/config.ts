import { env } from "@fuutu/env/marketing";
import type { AnalyticsProviderId } from "./types";

export interface AnalyticsConfig {
	provider: AnalyticsProviderId;
	/** Website / property identifier (Umami: websiteId, Plausible: domain, GA4: measurementId, …). */
	websiteId?: string;
	/** Optional self-hosted script URL (Umami / Plausible). */
	scriptUrl?: string;
	/** Whether analytics requires explicit consent (DSGVO). v1 = always true. */
	requireConsent: boolean;
	/** Cookie name for the consent decision (shared across subdomains). */
	consentCookieName: string;
	/** Cookie max-age in seconds (default: 1 year). */
	consentCookieMaxAge: number;
	/** Window event name dispatched when the consent decision changes. */
	consentEventName: string;
}

export const analyticsConfig: AnalyticsConfig = {
	provider: env.NEXT_PUBLIC_ANALYTICS_PROVIDER ?? "umami",
	websiteId: env.NEXT_PUBLIC_UMAMI_WEBSITE_ID,
	scriptUrl: env.NEXT_PUBLIC_UMAMI_SCRIPT_URL,
	requireConsent: true,
	consentCookieName: "fuutu.consent.v1",
	consentCookieMaxAge: 31_536_000,
	consentEventName: "fuutu:consent",
};
