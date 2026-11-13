import { describe, expect, it, vi } from "vitest";
import { getMailStrings } from "../i18n";

vi.mock("@fuutu/i18n/config", () => ({
	i18nConfig: {
		enabled: true,
		locales: {
			en: {
				currency: "USD",
				label: "English",
				dateFormat: "MM/DD/YYYY",
				direction: "ltr",
			},
			de: {
				currency: "EUR",
				label: "Deutsch",
				dateFormat: "DD.MM.YYYY",
				direction: "ltr",
				fallbackLocale: "en",
			},
		},
		defaultLocale: "en",
		defaultCurrency: "USD",
		localeCookieName: "NEXT_LOCALE",
	},
}));

describe("getMailStrings() with en and de enabled", () => {
	it("resolves a BCP-47 parent before falling back to the default", () => {
		expect(getMailStrings("de-AT").signature).toBe("— Dein Fuutu-Team");
	});

	it("falls back to the default when neither tag nor parent has a bundle", () => {
		expect(getMailStrings("fr-CA").signature).toBe("— The Fuutu team");
	});
});
