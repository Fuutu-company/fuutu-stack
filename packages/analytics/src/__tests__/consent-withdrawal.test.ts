import { describe, expect, it } from "vitest";
import {
	consentWithdrawalStrategy,
	needsReloadOnConsentChange,
} from "../consent-withdrawal";
import type { AnalyticsProvider } from "../types";

const base: AnalyticsProvider = {
	id: "plausible",
	requiresConsent: true,
	showConsentBanner: true,
	trackEvent() {},
	trackPageview() {},
};
const scriptOnly: AnalyticsProvider = {
	...base,
	getScriptProps: () => ({
		src: "https://example.com/s.js",
		strategy: "afterInteractive",
	}),
};
const gated: AnalyticsProvider = {
	...scriptOnly,
	installConsentGate() {},
};
const noScriptConfigured: AnalyticsProvider = {
	...base,
	getScriptProps: () => null,
};

describe("consentWithdrawalStrategy", () => {
	it("a provider with its own consent gate stops its script itself", () => {
		expect(consentWithdrawalStrategy(gated)).toBe("gate");
	});

	it("a script provider without a gate needs a page reload", () => {
		expect(consentWithdrawalStrategy(scriptOnly)).toBe("reload");
	});

	it("a provider without a script has nothing to stop", () => {
		expect(consentWithdrawalStrategy(base)).toBe("none");
	});
});

describe("needsReloadOnConsentChange", () => {
	it("reloads when consent is withdrawn from a loaded ungated script", () => {
		expect(needsReloadOnConsentChange(scriptOnly, true, false)).toBe(true);
	});

	it("does not reload a provider that gates its own script", () => {
		expect(needsReloadOnConsentChange(gated, true, false)).toBe(false);
	});

	it("does not reload when no script was injected", () => {
		expect(needsReloadOnConsentChange(base, true, false)).toBe(false);
		expect(needsReloadOnConsentChange(noScriptConfigured, true, false)).toBe(
			false,
		);
	});

	it("does not reload unless consent goes from granted to not granted", () => {
		expect(needsReloadOnConsentChange(scriptOnly, false, false)).toBe(false);
		expect(needsReloadOnConsentChange(scriptOnly, false, true)).toBe(false);
		expect(needsReloadOnConsentChange(scriptOnly, true, true)).toBe(false);
	});
});
