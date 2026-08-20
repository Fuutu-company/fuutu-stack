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

	describe("getScriptProps", () => {
		it("noop returns null (no script needed)", () => {
			expect(noopAnalyticsProvider.getScriptProps?.()).toBeNull();
		});

		it("pirsch returns null (server-side only)", () => {
			expect(pirschAnalyticsProvider.getScriptProps?.()).toBeNull();
		});

		it("plausible returns script props with domain attribute", () => {
			const props = plausibleAnalyticsProvider.getScriptProps?.();
			expect(props).not.toBeNull();
			expect(props?.src).toBe("https://plausible.io/js/script.js");
			expect(props?.strategy).toBe("afterInteractive");
			expect(props?.attributes).toHaveProperty("data-domain");
		});

		it("mixpanel returns script props", () => {
			const props = mixpanelAnalyticsProvider.getScriptProps?.();
			expect(props).not.toBeNull();
			expect(props?.src).toContain("mixpanel");
			expect(props?.strategy).toBe("afterInteractive");
		});

		it("ga4 returns script props with measurement ID", () => {
			const props = ga4AnalyticsProvider.getScriptProps?.();
			expect(props).not.toBeNull();
			expect(props?.src).toContain("googletagmanager.com");
			expect(props?.strategy).toBe("afterInteractive");
		});
	});
});
