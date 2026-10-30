import type { AnalyticsProvider, AnalyticsProviderId } from "../types";

/**
 * Skeleton analytics providers — inactive in v1.
 *
 * They are intentionally silent (vs. the storage skeletons which throw):
 * a missing analytics provider must never break a page render. Activation
 * happens by replacing the body with the real SDK call.
 *
 * Skeletons expose NO `getScriptProps` — <AnalyticsScript /> must only ever
 * inject a script for the active functional provider (Umami). Shipping
 * script props here would inject real third-party URLs with placeholder
 * IDs after consent. The expected script tag is noted per provider below.
 *
 * Skeletons default to `requiresConsent: true` — third-party trackers
 * (GA4, Mixpanel, …) must not load before consent, and the banner is
 * implied anyway while the gate is on. Revisit the flags when
 * activating a privacy-first provider; `analyticsConfig` can always
 * override both.
 */
function makeSkeleton(
	id: AnalyticsProviderId,
	requiresConsent = true,
	showConsentBanner = true,
): AnalyticsProvider {
	return {
		id,
		requiresConsent,
		showConsentBanner,
		trackEvent() {
			// not implemented — skeleton provider
		},
		trackPageview() {
			// not implemented — skeleton provider
		},
	};
}

/** Activate: inject `https://plausible.io/js/script.js` + `data-domain`. */
export const plausibleAnalyticsProvider = makeSkeleton("plausible");

/** Server-side only — no script tag needed on activation. */
export const pirschAnalyticsProvider = makeSkeleton("pirsch");

/** Activate: inject `https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js`. */
export const mixpanelAnalyticsProvider = makeSkeleton("mixpanel");

/** Activate: inject `https://www.googletagmanager.com/gtag/js?id=<G-*>`. */
export const ga4AnalyticsProvider = makeSkeleton("ga4");

// `noop` never tracks anything — nothing to consent to, nothing to show.
export const noopAnalyticsProvider = makeSkeleton("noop", false, false);
