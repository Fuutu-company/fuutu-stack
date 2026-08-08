import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { umamiAnalyticsProvider } from "../providers/umami";
import { testAnalyticsProviderContract } from "./provider-contract.test";

const trackMock = vi.fn();

beforeEach(() => {
	trackMock.mockReset();
	(globalThis as { umami?: unknown }).umami = { track: trackMock };
});

afterEach(() => {
	delete (globalThis as { umami?: unknown }).umami;
});

testAnalyticsProviderContract(() => umamiAnalyticsProvider, {
	id: "umami",
});

describe("umami provider — window.umami integration", () => {
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
});
