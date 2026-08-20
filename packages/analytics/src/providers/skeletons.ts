import type {
	AnalyticsProvider,
	AnalyticsProviderId,
	AnalyticsScriptProps,
} from "../types";

/**
 * Skeleton analytics providers — inactive in v1.
 *
 * They are intentionally silent (vs. the storage skeletons which throw):
 * a missing analytics provider must never break a page render. Activation
 * happens by replacing the body with the real SDK call.
 */
function makeSkeleton(
	id: AnalyticsProviderId,
	scriptProps?: AnalyticsScriptProps | null,
): AnalyticsProvider {
	return {
		id,
		trackEvent() {
			// not implemented — skeleton provider
		},
		trackPageview() {
			// not implemented — skeleton provider
		},
		getScriptProps: scriptProps !== undefined ? () => scriptProps : undefined,
	};
}

export const plausibleAnalyticsProvider = makeSkeleton("plausible", {
	src: "https://plausible.io/js/script.js",
	strategy: "afterInteractive",
	attributes: { "data-domain": "example.com" },
});

export const pirschAnalyticsProvider = makeSkeleton("pirsch", null);

export const mixpanelAnalyticsProvider = makeSkeleton("mixpanel", {
	src: "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js",
	strategy: "afterInteractive",
});

export const ga4AnalyticsProvider = makeSkeleton("ga4", {
	src: "https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX",
	strategy: "afterInteractive",
});

export const noopAnalyticsProvider = makeSkeleton("noop", null);
