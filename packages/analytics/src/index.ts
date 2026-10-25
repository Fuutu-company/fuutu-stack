import { createLogger } from "@fuutu/logs";
import { analyticsConfig } from "./config";
import { readConsentCookie } from "./consent-cookie";
import {
	ga4AnalyticsProvider,
	mixpanelAnalyticsProvider,
	noopAnalyticsProvider,
	pirschAnalyticsProvider,
	plausibleAnalyticsProvider,
} from "./providers/skeletons";
import { umamiAnalyticsProvider } from "./providers/umami";
import type {
	AnalyticsCspOrigins,
	AnalyticsEventProps,
	AnalyticsProvider,
} from "./types";

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
	AnalyticsCspOrigins,
	AnalyticsEventProps,
	AnalyticsProvider,
	AnalyticsProviderId,
	AnalyticsScriptProps,
} from "./types";

const log = createLogger({ scope: "analytics:resolve" });

// Selection warnings fire once per provider, not once per call —
// trackEvent() resolves on every event and must not spam the console.
const warnedProviders = new Set<string>();
const warnOnce = (id: string, message: string) => {
	if (warnedProviders.has(id)) return;
	warnedProviders.add(id);
	log.warn(message);
};

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
			warnOnce(
				analyticsConfig.provider,
				`analytics provider "${analyticsConfig.provider}" is a skeleton (not implemented) — events and scripts are no-ops.`,
			);
			return providers[analyticsConfig.provider];
		}
		case "noop":
			return noopAnalyticsProvider;
		default:
			warnOnce(
				analyticsConfig.provider,
				`unknown provider "${analyticsConfig.provider}", falling back to noop.`,
			);
			return noopAnalyticsProvider;
	}
}

/**
 * Whether the active provider requires explicit consent before tracking.
 * `analyticsConfig.requireConsent` overrides the provider default when set.
 */
export function providerRequiresConsent(): boolean {
	return (
		analyticsConfig.requireConsent ?? resolveAnalyticsProvider().requiresConsent
	);
}

/**
 * Whether the consent banner is shown. Always true when the provider
 * requires consent — without the banner there is no way to grant.
 * For consent-free providers it's a transparency notice controlled by
 * `analyticsConfig.showConsentBanner` or the provider's own flag.
 */
export function consentBannerVisible(): boolean {
	if (providerRequiresConsent()) return true;
	return (
		analyticsConfig.showConsentBanner ??
		resolveAnalyticsProvider().showConsentBanner
	);
}

/**
 * True when the active provider may track right now. Consent-required
 * providers need a `"granted"` cookie; consent-free providers track
 * immediately but still honor an explicit `"denied"` — a decline click
 * on a transparency banner is a real opt-out, not decoration. Read per
 * call so `deny()` gates manual `trackEvent`/`trackPageview` — an
 * already-injected script (e.g. Umami auto-track) keeps running until reload.
 */
export function hasTrackingConsent(): boolean {
	const value = readConsentCookie();
	if (!providerRequiresConsent()) return value !== "denied";
	return value === "granted";
}

/**
 * CSP origins the active provider needs (`script-src` for its script,
 * `connect-src` for event collection). Spread the arrays into each
 * app's `next.config.ts` — switching providers via env then needs no
 * app-config edits. Empty for providers without a browser footprint.
 */
export function analyticsCspOrigins(): AnalyticsCspOrigins {
	try {
		return (
			resolveAnalyticsProvider().getCspOrigins?.() ?? {
				scriptSrc: [],
				connectSrc: [],
			}
		);
	} catch {
		return { scriptSrc: [], connectSrc: [] };
	}
}

/**
 * Track a custom event via the active provider. Safe to call from any
 * environment — silently no-ops on the server or until consent.
 */
export function trackEvent(name: string, props?: AnalyticsEventProps) {
	if (!hasTrackingConsent()) return;
	resolveAnalyticsProvider().trackEvent(name, props);
}

/**
 * Track a page view via the active provider. Most script-tag providers
 * auto-track via the injected script — use this for SPA-style manual
 * sends. Same consent gate as `trackEvent`.
 */
export function trackPageview(url?: string) {
	if (!hasTrackingConsent()) return;
	resolveAnalyticsProvider().trackPageview(url);
}
