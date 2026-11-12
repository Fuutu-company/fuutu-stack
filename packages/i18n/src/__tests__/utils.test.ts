import { describe, expect, it, vi } from "vitest";
import {
	getAllLocales,
	getCurrency,
	getDateFormat,
	getDirection,
	getLocaleConfig,
	hasMultipleLocales,
	isValidLocale,
} from "../../lib/locale-utils";
import {
	getMessagesForLocale,
	importLocale,
	isKnownLocale,
	namespaceLoaders,
} from "../../lib/messages";
import type { Locale } from "../../types";

// Pin a two-locale config so these tests describe the helpers' behavior,
// not whichever locales the app currently enables in config.ts. Enabled
// locales of the real config are covered in enabled-locales.test.ts.
const fixture = vi.hoisted(() => ({
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
}));
vi.mock("../../config", () => ({ i18nConfig: fixture }));

// The fixture's second locale is not part of the real `Locale` union when
// the app runs single-locale — widen once, here.
const second = "de" as Locale;

describe("getAllLocales()", () => {
	it("returns all configured locales", () => {
		const locales = getAllLocales();
		expect(locales).toEqual(["en", "de"]);
	});

	it("returns an array", () => {
		expect(Array.isArray(getAllLocales())).toBe(true);
	});

	it("matches the keys in i18nConfig.locales", () => {
		const locales = getAllLocales();
		expect(locales).toEqual(Object.keys(fixture.locales));
	});
});

describe("hasMultipleLocales()", () => {
	it("is true when two locales are enabled", () => {
		expect(hasMultipleLocales()).toBe(true);
	});
});

describe("getCurrency()", () => {
	it("returns USD for en", () => {
		expect(getCurrency("en")).toBe("USD");
	});

	it("returns EUR for de", () => {
		expect(getCurrency(second)).toBe("EUR");
	});

	it("returns a string for each locale", () => {
		for (const locale of getAllLocales()) {
			expect(typeof getCurrency(locale)).toBe("string");
		}
	});
});

describe("getDateFormat()", () => {
	it("returns MM/DD/YYYY for en", () => {
		expect(getDateFormat("en")).toBe("MM/DD/YYYY");
	});

	it("returns DD.MM.YYYY for de", () => {
		expect(getDateFormat(second)).toBe("DD.MM.YYYY");
	});

	it("returns a string for each locale", () => {
		for (const locale of getAllLocales()) {
			expect(typeof getDateFormat(locale)).toBe("string");
		}
	});
});

describe("getDirection()", () => {
	it("returns ltr for en", () => {
		expect(getDirection("en")).toBe("ltr");
	});

	it("returns ltr for de", () => {
		expect(getDirection(second)).toBe("ltr");
	});
});

describe("getLocaleConfig()", () => {
	it("returns config for en", () => {
		const cfg = getLocaleConfig("en");
		expect(cfg.currency).toBe("USD");
		expect(cfg.label).toBe("English");
	});

	it("returns config for de", () => {
		const cfg = getLocaleConfig(second);
		expect(cfg.currency).toBe("EUR");
		expect(cfg.label).toBe("Deutsch");
	});
});

describe("isValidLocale()", () => {
	it("returns true for en", () => {
		expect(isValidLocale("en")).toBe(true);
	});

	it("returns true for de", () => {
		expect(isValidLocale("de")).toBe(true);
	});

	it("returns false for fr", () => {
		expect(isValidLocale("fr")).toBe(false);
	});

	it("returns false for empty string", () => {
		expect(isValidLocale("")).toBe(false);
	});

	it("returns false for random string", () => {
		expect(isValidLocale("xyz")).toBe(false);
	});

	it("returns false for uppercase EN", () => {
		expect(isValidLocale("EN")).toBe(false);
	});
});

describe("isKnownLocale()", () => {
	it("returns true for configured locales", () => {
		expect(isKnownLocale("en")).toBe(true);
		expect(isKnownLocale("de")).toBe(true);
	});

	it("returns true for a dormant locale with registered loaders", () => {
		namespaceLoaders.tlh = dormantLoaders;
		try {
			expect(isKnownLocale("tlh")).toBe(true);
			// Dormant ≠ configured: still not a valid (routable) locale.
			expect(isValidLocale("tlh")).toBe(false);
		} finally {
			delete namespaceLoaders.tlh;
		}
	});

	it.each(["xx", "__proto__", "constructor", "hasOwnProperty", ""])(
		"returns false for garbage tag %s",
		(tag) => {
			expect(isKnownLocale(tag)).toBe(false);
		},
	);
});

const dormantLoaders = {
	common: async () => ({ dormantProbe: "tlh-probe" }),
	marketing: async () => ({}),
	saas: async () => ({ dormantSaas: "tlh-saas" }),
	docs: async () => ({}),
};

describe("dormant locales", () => {
	it("importLocale loads a dormant locale's bundles instead of the default", async () => {
		namespaceLoaders.tlh = dormantLoaders;
		try {
			const messages = await importLocale("tlh", "saas");
			expect(messages).toMatchObject({
				dormantProbe: "tlh-probe",
				dormantSaas: "tlh-saas",
			});
			expect(messages).not.toHaveProperty("auth");
		} finally {
			delete namespaceLoaders.tlh;
		}
	});

	it("importLocale still falls back to the default locale for unknown tags", async () => {
		const messages = await importLocale("xx", "saas");
		const en = await importLocale("en", "saas");
		expect(messages).toEqual(en);
	});

	it("getMessagesForLocale merges a dormant locale over the default", async () => {
		namespaceLoaders.tlh = dormantLoaders;
		try {
			const messages = await getMessagesForLocale("tlh", "saas");
			expect(messages).toMatchObject({ dormantProbe: "tlh-probe" });
			// Default-locale keys still resolve via the fallback chain.
			expect(messages.auth.signIn).toBe("Sign In");
		} finally {
			delete namespaceLoaders.tlh;
		}
	});
});

describe("fallback chain", () => {
	it("importLocale falls back to default locale for invalid locale", async () => {
		const messages = await importLocale("fr");
		const defaultMessages = await importLocale("en");
		expect(messages).toEqual(defaultMessages);
	});

	it("importLocale returns messages for valid locale", async () => {
		const messages = await importLocale("de");
		expect(messages).toBeDefined();
		expect(typeof messages).toBe("object");
	});

	it("default locale is en", () => {
		expect(fixture.defaultLocale).toBe("en");
	});

	it("de has fallbackLocale set to en", () => {
		const deConfig = fixture.locales.de;
		expect(deConfig).toHaveProperty("fallbackLocale", "en");
	});

	it("en does not have a fallbackLocale (it is the default)", () => {
		const enConfig = fixture.locales.en;
		expect(enConfig).not.toHaveProperty("fallbackLocale");
	});
});

describe("app-scoped loading", () => {
	it("importLocale(en, marketing) includes home and common, not auth", async () => {
		const messages = await importLocale("en", "marketing");
		expect(messages).toHaveProperty("home");
		expect(messages).toHaveProperty("common");
		expect(messages).not.toHaveProperty("auth");
	});

	it("importLocale(en, saas) includes auth and common, not home", async () => {
		const messages = await importLocale("en", "saas");
		expect(messages).toHaveProperty("auth");
		expect(messages).toHaveProperty("common");
		expect(messages).not.toHaveProperty("home");
	});

	it("importLocale without app includes all namespaces", async () => {
		const messages = await importLocale("en");
		expect(messages).toHaveProperty("home");
		expect(messages).toHaveProperty("auth");
		expect(messages).toHaveProperty("common");
	});

	it("getMessagesForLocale(de, marketing) falls back to en for missing keys", async () => {
		const messages = await getMessagesForLocale("de", "marketing");
		expect(messages).toHaveProperty("home");
		expect(messages).toHaveProperty("common");
		expect(messages).not.toHaveProperty("auth");
	});

	it("merged messages keep marketing namespaces — docs stays nested", async () => {
		// Docs `nav`/`home` must not shadow marketing's in the no-app merge.
		const messages = await importLocale("en");
		// Marketing nav content has `resources`; the docs nav.json carries
		// `search`/`theme` keys. If docs overwrote top-level `nav`, `resources`
		// would be gone.
		expect(messages.nav).toHaveProperty("resources");
		expect(messages.nav).not.toHaveProperty("search");
		expect(messages.docs).toHaveProperty("nav");
	});
});
