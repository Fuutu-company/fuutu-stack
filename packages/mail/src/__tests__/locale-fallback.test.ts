import { describe, expect, it, vi } from "vitest";
import { getMailStrings } from "../i18n";

// Single enabled locale: `de` mail strings stay on disk as a dormant bundle.
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
		},
		defaultLocale: "en",
		defaultCurrency: "USD",
		localeCookieName: "NEXT_LOCALE",
	},
}));

describe("getMailStrings() with a single enabled locale", () => {
	it("uses the default locale when none is given", () => {
		expect(getMailStrings().signature).toBe("— The Fuutu team");
	});

	it("still serves a dormant locale's bundle for a stored preference", () => {
		expect(getMailStrings("de").signature).toBe("— Dein Fuutu-Team");
	});

	it("falls back to the default locale when the regional parent is not enabled", () => {
		expect(getMailStrings("de-AT").signature).toBe("— The Fuutu team");
		expect(getMailStrings("fr-CA").signature).toBe("— The Fuutu team");
	});

	it("accepts arbitrary strings without throwing", () => {
		expect(getMailStrings("").signature).toBe("— The Fuutu team");
		expect(getMailStrings("__proto__").signature).toBe("— The Fuutu team");
	});
});
