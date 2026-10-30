import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsConfig } from "../config";
import { readConsentCookie } from "../consent-cookie";
import {
	analyticsCspOrigins,
	consentBannerVisible,
	hasTrackingConsent,
	providerRequiresConsent,
	trackEvent,
	trackPageview,
} from "../index";
import { ga4AnalyticsProvider } from "../providers/skeletons";

const originalProvider = analyticsConfig.provider;
const originalRequireConsent = analyticsConfig.requireConsent;
const originalShowBanner = analyticsConfig.showConsentBanner;
const originalCookieName = analyticsConfig.consentCookieName;

function setCookie(value: string) {
	(globalThis as { document?: unknown }).document = { cookie: value };
}

afterEach(() => {
	analyticsConfig.provider = originalProvider;
	analyticsConfig.requireConsent = originalRequireConsent;
	analyticsConfig.showConsentBanner = originalShowBanner;
	analyticsConfig.consentCookieName = originalCookieName;
	delete (globalThis as { document?: unknown }).document;
	delete (globalThis as { umami?: unknown }).umami;
	vi.restoreAllMocks();
});

describe("providerRequiresConsent", () => {
	it("follows the provider default (umami → false)", () => {
		analyticsConfig.provider = "umami";
		expect(providerRequiresConsent()).toBe(false);
	});

	it("follows the provider default (skeletons → true)", () => {
		for (const id of ["plausible", "pirsch", "mixpanel", "ga4"] as const) {
			analyticsConfig.provider = id;
			expect(providerRequiresConsent()).toBe(true);
		}
	});

	it("analyticsConfig.requireConsent overrides the provider default", () => {
		analyticsConfig.provider = "umami";
		analyticsConfig.requireConsent = true;
		expect(providerRequiresConsent()).toBe(true);

		analyticsConfig.provider = "ga4";
		analyticsConfig.requireConsent = false;
		expect(providerRequiresConsent()).toBe(false);
	});
});

describe("consentBannerVisible", () => {
	it("is always true for consent-required providers", () => {
		analyticsConfig.provider = "ga4";
		expect(consentBannerVisible()).toBe(true);
		// even when the banner override says hide — the gate needs it
		analyticsConfig.showConsentBanner = false;
		expect(consentBannerVisible()).toBe(true);
	});

	it("follows the provider flag for consent-free providers", () => {
		analyticsConfig.provider = "umami";
		expect(consentBannerVisible()).toBe(true);
		analyticsConfig.provider = "noop";
		expect(consentBannerVisible()).toBe(false);
	});

	it("analyticsConfig.showConsentBanner overrides the provider flag", () => {
		analyticsConfig.provider = "umami";
		analyticsConfig.showConsentBanner = false;
		expect(consentBannerVisible()).toBe(false);
		analyticsConfig.showConsentBanner = true;
		expect(consentBannerVisible()).toBe(true);
	});
});

describe("hasTrackingConsent", () => {
	it("is true for consent-free providers without any cookie", () => {
		analyticsConfig.provider = "umami";
		expect(hasTrackingConsent()).toBe(true);
	});

	it("honors an explicit deny even for consent-free providers", () => {
		// A decline click on a transparency banner is a real opt-out.
		analyticsConfig.provider = "umami";
		setCookie(`${analyticsConfig.consentCookieName}=denied`);
		expect(hasTrackingConsent()).toBe(false);
	});

	it("is false for consent-required providers without a decision", () => {
		analyticsConfig.provider = "ga4";
		expect(hasTrackingConsent()).toBe(false);
		setCookie("other=value");
		expect(hasTrackingConsent()).toBe(false);
	});

	it("is true only when the cookie says granted", () => {
		analyticsConfig.provider = "ga4";
		setCookie(`${analyticsConfig.consentCookieName}=denied`);
		expect(hasTrackingConsent()).toBe(false);
		setCookie(`${analyticsConfig.consentCookieName}=granted`);
		expect(hasTrackingConsent()).toBe(true);
	});
});

describe("trackEvent / trackPageview consent gate", () => {
	const umamiTrack = vi.fn();

	beforeEach(() => {
		umamiTrack.mockReset();
		(globalThis as { umami?: unknown }).umami = { track: umamiTrack };
	});

	it("tracks immediately for consent-free providers", () => {
		analyticsConfig.provider = "umami";
		trackEvent("signup", { plan: "pro" });
		expect(umamiTrack).toHaveBeenCalledWith("signup", { plan: "pro" });
	});

	it("does not reach the provider before consent is granted", () => {
		analyticsConfig.provider = "ga4";
		const spy = vi.spyOn(ga4AnalyticsProvider, "trackEvent");
		trackEvent("signup");
		expect(spy).not.toHaveBeenCalled();
	});

	it("stops tracking when consent is withdrawn (deny after grant)", () => {
		analyticsConfig.provider = "ga4";
		const spy = vi.spyOn(ga4AnalyticsProvider, "trackEvent");
		setCookie(`${analyticsConfig.consentCookieName}=granted`);
		trackEvent("a");
		expect(spy).toHaveBeenCalledTimes(1);
		// Consent withdrawn — next call must not reach the provider,
		// even if its script is already loaded.
		setCookie(`${analyticsConfig.consentCookieName}=denied`);
		trackEvent("b");
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("gates trackPageview the same way", () => {
		analyticsConfig.provider = "ga4";
		const spy = vi.spyOn(ga4AnalyticsProvider, "trackPageview");
		trackPageview("/pricing");
		expect(spy).not.toHaveBeenCalled();
		setCookie(`${analyticsConfig.consentCookieName}=granted`);
		trackPageview("/pricing");
		expect(spy).toHaveBeenCalledWith("/pricing");
	});

	it("stops tracking on deny for consent-free providers too", () => {
		analyticsConfig.provider = "umami";
		trackEvent("a");
		expect(umamiTrack).toHaveBeenCalledTimes(1);
		setCookie(`${analyticsConfig.consentCookieName}=denied`);
		trackEvent("b");
		expect(umamiTrack).toHaveBeenCalledTimes(1);
	});
});

describe("analyticsCspOrigins", () => {
	const originalWebsiteId = analyticsConfig.websiteId;

	afterEach(() => {
		analyticsConfig.websiteId = originalWebsiteId;
	});

	it("returns the umami origins when a websiteId is configured", () => {
		analyticsConfig.provider = "umami";
		analyticsConfig.websiteId = "test-id";
		const origins = analyticsCspOrigins();
		expect(origins.scriptSrc).toEqual(["https://cloud.umami.is"]);
		expect(origins.connectSrc).toEqual(["https://cloud.umami.is"]);
	});

	it("returns empty origins for providers without a browser footprint", () => {
		for (const id of ["ga4", "noop"] as const) {
			analyticsConfig.provider = id;
			expect(analyticsCspOrigins()).toEqual({
				scriptSrc: [],
				connectSrc: [],
			});
		}
	});
});

describe("readConsentCookie robustness", () => {
	it("reads the consent cookie despite malformed foreign cookies", () => {
		// Regression: decoding the whole document.cookie string threw
		// URIError when any unrelated cookie contained a bare "%".
		setCookie(`broken=%invalid; ${analyticsConfig.consentCookieName}=granted`);
		expect(readConsentCookie()).toBe("granted");
	});

	it("returns null for a malformed consent value", () => {
		setCookie(`${analyticsConfig.consentCookieName}=%`);
		expect(readConsentCookie()).toBeNull();
	});
});
