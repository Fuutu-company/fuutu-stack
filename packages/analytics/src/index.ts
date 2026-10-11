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
	AnalyticsScriptProps,
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
		case "pirsch":
		case "mixpanel":
		case "ga4": {
			// Skeleton selections resolve to silent no-ops (deliberate:
			// analytics must never break a render) — but a misconfigured
			// env should at least surface once, at selection time.
			const providers = {
				plausible: plausibleAnalyticsProvider,
				pirsch: pirschAnalyticsProvider,
				mixpanel: mixpanelAnalyticsProvider,
				ga4: ga4AnalyticsProvider,
			} as const;
			log.warn(
				`analytics provider "${analyticsConfig.provider}" is a skeleton (not implemented) — events and scripts are no-ops.`,
			);
			return providers[analyticsConfig.provider];
		}
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
