import { createLogger } from "@fuutu/logs";
import { analyticsConfig } from "./config";
import {
	ga4AnalyticsProvider,
	mixpanelAnalyticsProvider,
	noopAnalyticsProvider,
	pirschAnalyticsProvider,
	plausibleAnalyticsProvider,
} from "./providers/skeletons";
import { umamiAnalyticsProvider } from "./providers/umami";
import type { AnalyticsEventProps, AnalyticsProvider } from "./types";

export {
	type AnalyticsConfig,
	analyticsConfig,
} from "./config";
export {
	ga4AnalyticsProvider,
	mixpanelAnalyticsProvider,
	noopAnalyticsProvider,
	pirschAnalyticsProvider,
	plausibleAnalyticsProvider,
} from "./providers/skeletons";
export { umamiAnalyticsProvider } from "./providers/umami";
export type {
	AnalyticsEventProps,
	AnalyticsProvider,
	AnalyticsProviderId,
} from "./types";

const log = createLogger({ scope: "analytics:resolve" });

/**
 * Resolve the active analytics provider from `analyticsConfig.provider`.
 */
export function resolveAnalyticsProvider(): AnalyticsProvider {
	switch (analyticsConfig.provider) {
		case "umami":
			return umamiAnalyticsProvider;
		case "plausible":
			return plausibleAnalyticsProvider;
		case "pirsch":
			return pirschAnalyticsProvider;
		case "mixpanel":
			return mixpanelAnalyticsProvider;
		case "ga4":
			return ga4AnalyticsProvider;
		case "noop":
			return noopAnalyticsProvider;
		default:
			log.warn(
				`unknown provider "${analyticsConfig.provider}", falling back to noop.`,
			);
			return noopAnalyticsProvider;
	}
}

/**
 * Track a custom event via the active provider. Safe to call from any
 * environment — silently no-ops on the server or before consent.
 */
export function trackEvent(name: string, props?: AnalyticsEventProps) {
	resolveAnalyticsProvider().trackEvent(name, props);
}
