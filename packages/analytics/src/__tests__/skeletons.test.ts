import { describe, expect, it, vi } from "vitest";
import {
	ga4AnalyticsProvider,
	mixpanelAnalyticsProvider,
	noopAnalyticsProvider,
	pirschAnalyticsProvider,
	plausibleAnalyticsProvider,
} from "../providers/skeletons";
import { testAnalyticsProviderContract } from "./provider-contract.test";

testAnalyticsProviderContract(() => plausibleAnalyticsProvider, {
	id: "plausible",
});

testAnalyticsProviderContract(() => pirschAnalyticsProvider, {
	id: "pirsch",
});

testAnalyticsProviderContract(() => mixpanelAnalyticsProvider, {
	id: "mixpanel",
});

testAnalyticsProviderContract(() => ga4AnalyticsProvider, {
	id: "ga4",
});

testAnalyticsProviderContract(() => noopAnalyticsProvider, {
	id: "noop",
});

describe("analytics skeletons — silent no-ops with no side effects", () => {
	it("plausible does not call any global tracker", () => {
		const spy = vi.fn();
		(globalThis as { plausible?: unknown }).plausible = spy;
		plausibleAnalyticsProvider.trackEvent("test");
		plausibleAnalyticsProvider.trackPageview("/x");
		expect(spy).not.toHaveBeenCalled();
		delete (globalThis as { plausible?: unknown }).plausible;
	});

	it("noop trackEvent and trackPageview are truly silent", () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		noopAnalyticsProvider.trackEvent("test");
		noopAnalyticsProvider.trackPageview();
		expect(consoleSpy).not.toHaveBeenCalled();
		consoleSpy.mockRestore();
	});
});
