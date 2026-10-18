/**
 * @fuutu/analytics — provider-agnostic web analytics interface.
 *
 * v1 active: Umami (privacy-first, self-hostable). Skeletons:
 * Plausible, Pirsch, Mixpanel, GA4. Each provider declares whether it
 * requires explicit consent via `requiresConsent`; the consent layer
 * (`ConsentProvider`) gates script injection and event tracking for
 * consent-required providers.
 */

export type AnalyticsProviderId =
	| "umami"
	| "plausible"
	| "pirsch"
	| "mixpanel"
	| "ga4"
	| "noop";

export interface AnalyticsEventProps {
	[key: string]: string | number | boolean | null | undefined;
}

export interface AnalyticsScriptProps {
	src: string;
	strategy: "afterInteractive" | "lazyOnload" | "beforeInteractive";
	attributes?: Record<string, string>;
}

/** Origins an app must allow in its Content-Security-Policy. */
export interface AnalyticsCspOrigins {
	/** Origins for `script-src` (the provider's script tag). */
	scriptSrc: string[];
	/** Origins for `connect-src` (the event collection endpoint). */
	connectSrc: string[];
}

export interface AnalyticsProvider {
	readonly id: AnalyticsProviderId;
	/**
	 * Whether this provider requires explicit user consent before it may
	 * load scripts or send events. Privacy-first, cookieless providers
	 * (Umami) ship `false`; third-party trackers (GA4, Mixpanel, …)
	 * ship `true`. `analyticsConfig.requireConsent` overrides this.
	 */
	readonly requiresConsent: boolean;
	/**
	 * Whether the consent banner is shown even though this provider
	 * doesn't gate on consent. Pure transparency — tracking starts
	 * immediately either way (an explicit deny is still honored).
	 * Ignored when `requiresConsent` is `true`: the banner is always
	 * shown then, otherwise consent could never be granted.
	 * `analyticsConfig.showConsentBanner` overrides this.
	 */
	readonly showConsentBanner: boolean;
	/**
	 * Track a custom event. Implementations MUST silently swallow
	 * errors (analytics is never allowed to break the app).
	 */
	trackEvent(name: string, props?: AnalyticsEventProps): void;
	/**
	 * Track a page view. Most script-tag providers (Umami, Plausible)
	 * auto-track via the script — this is for SPA-style manual sends.
	 */
	trackPageview(url?: string): void;
	/**
	 * Returns script tag props for client-side injection, or null if no script needed (server-side-only analytics).
	 */
	getScriptProps?(): AnalyticsScriptProps | null;
	/**
	 * Origins the app's CSP must allow for this provider. Kept in the
	 * provider so swapping providers via env requires zero app-config
	 * edits — `next.config.ts` spreads `analyticsCspOrigins()` into
	 * `script-src`/`connect-src`. Omit for providers that inject no
	 * script and call no browser-side endpoint (skeletons, server-side
	 * providers, noop).
	 */
	getCspOrigins?(): AnalyticsCspOrigins;
}
