import { analyticsConfig } from "../config";
import type {
	AnalyticsCspOrigins,
	AnalyticsEventProps,
	AnalyticsProvider,
	AnalyticsScriptProps,
} from "../types";

interface UmamiGlobal {
	track: (
		nameOrPayload?: string | Record<string, unknown>,
		props?: AnalyticsEventProps,
	) => void;
}

/** Global the script calls before each send (`data-before-send`). */
const BEFORE_SEND_GLOBAL = "__fuutuUmamiBeforeSend";

function getUmami(): UmamiGlobal | undefined {
	return (globalThis as { umami?: UmamiGlobal }).umami;
}

/**
 * Umami provider — relies on the Umami script tag (see <AnalyticsScript />).
 * All calls silently no-op if the script hasn't loaded.
 *
 * `requiresConsent: false` — Umami is cookieless and collects no personal
 * data, so it is designed to track without waiting for consent.
 * `showConsentBanner: true` — the banner renders as a notice with an
 * opt-out; the opt-out is honored via `hasTrackingConsent()` and, for the
 * loaded script, the `data-before-send` gate. `data-do-not-track` skips
 * browsers that send Do Not Track.
 * `data-before-send` needs Umami v2.18.0 or later (Umami Cloud has it).
 * An older self-hosted tracker ignores it: the opt-out then stops only
 * `trackEvent`/`trackPageview`, not the script's auto-tracked page views.
 * Kit owners can hide the banner or force the gate via `analyticsConfig`.
 */
export const umamiAnalyticsProvider: AnalyticsProvider = {
	id: "umami",
	requiresConsent: false,
	showConsentBanner: true,

	trackEvent(name, props) {
		try {
			getUmami()?.track(name, props);
		} catch {
			// analytics never breaks the app
		}
	},

	trackPageview(url) {
		try {
			if (url) {
				getUmami()?.track({ url });
			} else {
				getUmami()?.track();
			}
		} catch {
			// noop
		}
	},

	getScriptProps(): AnalyticsScriptProps | null {
		if (!analyticsConfig.websiteId) return null;
		return {
			src: umamiScriptUrl(),
			strategy: "afterInteractive",
			attributes: {
				"data-website-id": analyticsConfig.websiteId,
				"data-auto-track": "true",
				"data-do-not-track": "true",
				"data-before-send": BEFORE_SEND_GLOBAL,
			},
		};
	},

	installConsentGate(hasConsent) {
		// Returning null makes the script drop the send.
		(globalThis as Record<string, unknown>)[BEFORE_SEND_GLOBAL] = (
			_type: string,
			payload: unknown,
		) => (hasConsent() ? payload : null);
	},

	getCspOrigins(): AnalyticsCspOrigins {
		// No websiteId → no script is ever injected → nothing to allow.
		if (!analyticsConfig.websiteId) return { scriptSrc: [], connectSrc: [] };
		// Script tag and event collection (/api/send) share one origin.
		try {
			const origin = new URL(umamiScriptUrl()).origin;
			return { scriptSrc: [origin], connectSrc: [origin] };
		} catch {
			return { scriptSrc: [], connectSrc: [] };
		}
	},
};

function umamiScriptUrl(): string {
	return analyticsConfig.scriptUrl ?? "https://cloud.umami.is/script.js";
}
