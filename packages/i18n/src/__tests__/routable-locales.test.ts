import { describe, expect, it, vi } from "vitest";

// Sitemaps and hreflang alternates list only URLs that route: with
// `i18nConfig.enabled: false` the apps serve the default locale unprefixed
// (`localePrefix: "never"`), so the other locales have no URLs of their own.
const config = vi.hoisted(() => ({
	i18nConfig: {
		enabled: true,
		locales: {
			en: { currency: "USD", label: "English", direction: "ltr" },
			de: { currency: "EUR", label: "Deutsch", direction: "ltr" },
		},
		defaultLocale: "en",
	},
}));
vi.mock("../../config", () => config);

const { getRoutableLocales } = await import("../../lib/locale-utils");

describe("getRoutableLocales()", () => {
	it("returns every enabled locale while i18n is on", () => {
		config.i18nConfig.enabled = true;
		expect(getRoutableLocales()).toEqual(["en", "de"]);
	});

	it("returns only the default locale while i18n is off", () => {
		config.i18nConfig.enabled = false;
		try {
			expect(getRoutableLocales()).toEqual(["en"]);
		} finally {
			config.i18nConfig.enabled = true;
		}
	});
});
