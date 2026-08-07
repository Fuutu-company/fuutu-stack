/**
 * @fuutu/analytics — provider-agnostic web analytics interface.
 *
 * v1 active: Umami (privacy-first, self-hostable). Skeletons:
 * Plausible, Pirsch, Mixpanel, GA4. Tracking is opt-in via the
 * consent layer (`ConsentProvider`) — providers MUST be a no-op
 * until the user grants consent.
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

export interface AnalyticsProvider {
	readonly id: AnalyticsProviderId;
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
}
