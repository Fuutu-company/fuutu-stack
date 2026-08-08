import type { AnalyticsEventProps, AnalyticsProvider } from "../types";

interface UmamiGlobal {
	track: (
		nameOrPayload?: string | Record<string, unknown>,
		props?: AnalyticsEventProps,
	) => void;
}

function getUmami(): UmamiGlobal | undefined {
	if (typeof globalThis === "undefined") return undefined;
	return (globalThis as { umami?: UmamiGlobal }).umami;
}

/**
 * Umami provider — relies on the Umami script tag (see <AnalyticsScript />).
 * All calls silently no-op if the script hasn't loaded or consent was denied.
 */
export const umamiAnalyticsProvider: AnalyticsProvider = {
	id: "umami",

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
};
