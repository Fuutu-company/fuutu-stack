import { describe, expect, it } from "vitest";
import type { AnalyticsProvider, AnalyticsProviderId } from "../types";

export interface AnalyticsProviderContractOptions {
	/** Expected provider id. */
	readonly id: AnalyticsProviderId;
}

/**
 * Shared contract every AnalyticsProvider must satisfy.
 *
 * Analytics skeletons are SILENT no-ops by design — analytics must never
 * break a page render. So the contract asserts no-throws for ALL providers.
 */
export function testAnalyticsProviderContract(
	createProvider: () => AnalyticsProvider,
	options: AnalyticsProviderContractOptions,
): void {
	describe(`AnalyticsProvider contract — ${options.id}`, () => {
		it("exposes the expected id", () => {
			const provider = createProvider();
			expect(provider.id).toBe(options.id);
		});

		it("declares requiresConsent as a boolean", () => {
			const provider = createProvider();
			expect(typeof provider.requiresConsent).toBe("boolean");
		});

		it("declares showConsentBanner as a boolean", () => {
			const provider = createProvider();
			expect(typeof provider.showConsentBanner).toBe("boolean");
		});

		it("trackEvent() does not throw", () => {
			const provider = createProvider();
			expect(() => provider.trackEvent("test_event")).not.toThrow();
		});

		it("trackEvent() accepts props without throwing", () => {
			const provider = createProvider();
			expect(() =>
				provider.trackEvent("test_event", { foo: "bar", count: 1 }),
			).not.toThrow();
		});

		it("trackPageview() does not throw", () => {
			const provider = createProvider();
			expect(() => provider.trackPageview()).not.toThrow();
		});

		it("trackPageview() accepts a URL without throwing", () => {
			const provider = createProvider();
			expect(() => provider.trackPageview("/dashboard")).not.toThrow();
		});

		it("getCspOrigins() returns origin arrays when defined", () => {
			const provider = createProvider();
			const origins = provider.getCspOrigins?.();
			if (origins === undefined) return;
			expect(Array.isArray(origins.scriptSrc)).toBe(true);
			expect(Array.isArray(origins.connectSrc)).toBe(true);
		});
	});
}
