import { describe, expect, it } from "vitest";
import { i18nConfig } from "../../config";
import {
	getAllLocales,
	getCurrency,
	getDateFormat,
	getDirection,
	getLocaleConfig,
	isValidLocale,
} from "../../lib/locale-utils";
import { getMessagesForLocale, importLocale } from "../../lib/messages";

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
		expect(locales).toEqual(Object.keys(i18nConfig.locales));
	});
});

describe("getCurrency()", () => {
	it("returns USD for en", () => {
		expect(getCurrency("en")).toBe("USD");
	});

	it("returns EUR for de", () => {
		expect(getCurrency("de")).toBe("EUR");
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
		expect(getDateFormat("de")).toBe("DD.MM.YYYY");
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
		expect(getDirection("de")).toBe("ltr");
	});
});

describe("getLocaleConfig()", () => {
	it("returns config for en", () => {
		const cfg = getLocaleConfig("en");
		expect(cfg.currency).toBe("USD");
		expect(cfg.label).toBe("English");
	});

	it("returns config for de", () => {
		const cfg = getLocaleConfig("de");
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
		expect(i18nConfig.defaultLocale).toBe("en");
	});

	it("de has fallbackLocale set to en", () => {
		const deConfig = i18nConfig.locales.de;
		expect(deConfig).toHaveProperty("fallbackLocale", "en");
	});

	it("en does not have a fallbackLocale (it is the default)", () => {
		const enConfig = i18nConfig.locales.en;
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
});
