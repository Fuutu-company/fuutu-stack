import type { AnalyticsProvider, AnalyticsProviderId } from "../types";

/**
 * Skeleton analytics providers — inactive in v1.
 *
 * They are intentionally silent (vs. the storage skeletons which throw):
 * a missing analytics provider must never break a page render. Activation
 * happens by replacing the body with the real SDK call.
 */
function makeSkeleton(id: AnalyticsProviderId): AnalyticsProvider {
	return {
		id,
		trackEvent() {
			// not implemented — skeleton provider
		},
		trackPageview() {
			// not implemented — skeleton provider
		},
	};
}

export const plausibleAnalyticsProvider = makeSkeleton("plausible");
export const pirschAnalyticsProvider = makeSkeleton("pirsch");
export const mixpanelAnalyticsProvider = makeSkeleton("mixpanel");
export const ga4AnalyticsProvider = makeSkeleton("ga4");
export const noopAnalyticsProvider = makeSkeleton("noop");
