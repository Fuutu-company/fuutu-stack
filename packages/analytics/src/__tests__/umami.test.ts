import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsConfig } from "../config";
import { umamiAnalyticsProvider } from "../providers/umami";
import { testAnalyticsProviderContract } from "./provider-contract";

const trackMock = vi.fn();
const originalWebsiteId = analyticsConfig.websiteId;
const originalScriptUrl = analyticsConfig.scriptUrl;

beforeEach(() => {
	trackMock.mockReset();
	(globalThis as { umami?: unknown }).umami = { track: trackMock };
});

afterEach(() => {
	delete (globalThis as { umami?: unknown }).umami;
	analyticsConfig.websiteId = originalWebsiteId;
	analyticsConfig.scriptUrl = originalScriptUrl;
});

testAnalyticsProviderContract(() => umamiAnalyticsProvider, {
	id: "umami",
});

describe("umami provider — window.umami integration", () => {
	it("is consent-free (requiresConsent: false)", () => {
		expect(umamiAnalyticsProvider.requiresConsent).toBe(false);
	});

	it("trackEvent calls window.umami.track with name and props", () => {
		umamiAnalyticsProvider.trackEvent("button_click", { label: "signup" });
		expect(trackMock).toHaveBeenCalledWith("button_click", {
			label: "signup",
		});
	});

	it("trackPageview calls window.umami.track with the url payload", () => {
		umamiAnalyticsProvider.trackPageview("/dashboard");
		expect(trackMock).toHaveBeenCalledWith({ url: "/dashboard" });
	});

	it("trackPageview without url calls track with no args", () => {
		umamiAnalyticsProvider.trackPageview();
		expect(trackMock).toHaveBeenCalledWith();
	});

	it("does not throw when window.umami is absent", () => {
		delete (globalThis as { umami?: unknown }).umami;
		expect(() => umamiAnalyticsProvider.trackEvent("test")).not.toThrow();
		expect(() => umamiAnalyticsProvider.trackPageview()).not.toThrow();
	});

	describe("getScriptProps", () => {
		it("returns script props when websiteId is configured", () => {
			analyticsConfig.websiteId = "test-website-id";
			const props = umamiAnalyticsProvider.getScriptProps?.();
			expect(props).not.toBeNull();
			expect(props?.src).toContain("script.js");
			expect(props?.strategy).toBe("afterInteractive");
			expect(props?.attributes).toHaveProperty("data-website-id");
			expect(props?.attributes).toHaveProperty("data-auto-track", "true");
		});

		it("tells the script to honor Do Not Track", () => {
			analyticsConfig.websiteId = "test-website-id";
			const props = umamiAnalyticsProvider.getScriptProps?.();
			expect(props?.attributes?.["data-do-not-track"]).toBe("true");
		});

		it("names the consent gate as the script's before-send hook", () => {
			analyticsConfig.websiteId = "test-website-id";
			const props = umamiAnalyticsProvider.getScriptProps?.();
			expect(props?.attributes?.["data-before-send"]).toBe(
				"__fuutuUmamiBeforeSend",
			);
		});

		it("returns null when websiteId is not configured", () => {
			analyticsConfig.websiteId = undefined;
			const props = umamiAnalyticsProvider.getScriptProps?.();
			expect(props).toBeNull();
		});
	});

	describe("installConsentGate", () => {
		type BeforeSend = (type: string, payload: object) => object | null;
		const beforeSend = () =>
			(globalThis as { __fuutuUmamiBeforeSend?: BeforeSend })
				.__fuutuUmamiBeforeSend;

		afterEach(() => {
			delete (globalThis as { __fuutuUmamiBeforeSend?: unknown })
				.__fuutuUmamiBeforeSend;
		});

		it("drops every send of an already-loaded script after an opt-out", () => {
			let allowed = true;
			umamiAnalyticsProvider.installConsentGate?.(() => allowed);
			const payload = { url: "/pricing" };
			expect(beforeSend()?.("event", payload)).toBe(payload);
			allowed = false;
			expect(beforeSend()?.("event", payload)).toBeNull();
		});
	});

	describe("getCspOrigins", () => {
		it("returns the cloud.umami.is origin for script + connect", () => {
			analyticsConfig.websiteId = "test-website-id";
			analyticsConfig.scriptUrl = undefined;
			const origins = umamiAnalyticsProvider.getCspOrigins?.();
			expect(origins?.scriptSrc).toEqual(["https://cloud.umami.is"]);
			expect(origins?.connectSrc).toEqual(["https://cloud.umami.is"]);
		});

		it("derives the origin from a custom self-hosted scriptUrl", () => {
			analyticsConfig.websiteId = "test-website-id";
			analyticsConfig.scriptUrl = "https://analytics.example.com/script.js";
			const origins = umamiAnalyticsProvider.getCspOrigins?.();
			expect(origins?.scriptSrc).toEqual(["https://analytics.example.com"]);
		});

		it("returns empty origins when no websiteId is configured", () => {
			analyticsConfig.websiteId = undefined;
			const origins = umamiAnalyticsProvider.getCspOrigins?.();
			expect(origins).toEqual({ scriptSrc: [], connectSrc: [] });
		});
	});
});
