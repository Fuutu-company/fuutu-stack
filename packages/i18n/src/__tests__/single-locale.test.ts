import { describe, expect, it, vi } from "vitest";
import {
	getAllLocales,
	hasMultipleLocales,
	isValidLocale,
} from "../../lib/locale-utils";
import {
	getFallbackChain,
	getMessagesForLocale,
	isKnownLocale,
} from "../../lib/messages";

// Only `en` is enabled; `de` bundles stay wired in namespaceLoaders as a
// dormant locale — exactly what a buyer gets by removing `de` from
// i18nConfig.locales without deleting translations/de/.
vi.mock("../../config", () => ({
	i18nConfig: {
		enabled: true,
		locales: {
			en: {
				currency: "USD",
				label: "English",
				dateFormat: "MM/DD/YYYY",
				direction: "ltr",
			},
		},
		defaultLocale: "en",
		defaultCurrency: "USD",
		localeCookieName: "NEXT_LOCALE",
	},
}));

describe("single enabled locale", () => {
	it("exposes only the enabled locale", () => {
		expect(getAllLocales()).toEqual(["en"]);
	});

	it("reports that there is nothing to switch between", () => {
		expect(hasMultipleLocales()).toBe(false);
	});

	it("rejects a dormant locale for routing but still knows its bundles", () => {
		expect(isValidLocale("de")).toBe(false);
		expect(isKnownLocale("de")).toBe(true);
	});

	it("falls back to the default locale for a dormant or regional tag", () => {
		expect(getFallbackChain("de")).toEqual(["de", "en"]);
		expect(getFallbackChain("fr-CA")).toEqual(["fr-CA", "en"]);
	});

	it("resolves messages for the enabled locale without touching dormant bundles", async () => {
		const messages = await getMessagesForLocale("en", "saas");
		expect(messages.auth.signIn).toBe("Sign In");
	});

	it("serves default-locale messages for an unknown tag", async () => {
		const unknown = await getMessagesForLocale("fr", "saas");
		const en = await getMessagesForLocale("en", "saas");
		expect(unknown).toEqual(en);
	});
});
