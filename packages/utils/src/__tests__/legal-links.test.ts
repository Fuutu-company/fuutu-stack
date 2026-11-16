import { describe, expect, it } from "vitest";
import { legalLinks, legalPageUrl } from "../legal-links";

const base = {
	marketingUrl: "https://site.test",
	defaultLocale: "en",
};

describe("legalPageUrl", () => {
	it("leaves the default locale unprefixed (marketing: as-needed)", () => {
		expect(legalPageUrl("privacy", { ...base, locale: "en" })).toBe(
			"https://site.test/legal/privacy",
		);
	});

	it("prefixes every other locale", () => {
		expect(legalPageUrl("imprint", { ...base, locale: "de" })).toBe(
			"https://site.test/de/legal/imprint",
		);
	});

	it("drops a trailing slash of the base URL", () => {
		expect(
			legalPageUrl("terms", {
				...base,
				marketingUrl: "https://site.test/",
				locale: "en",
			}),
		).toBe("https://site.test/legal/terms");
	});

	it("is null without a marketing URL", () => {
		expect(
			legalPageUrl("privacy", {
				...base,
				marketingUrl: undefined,
				locale: "en",
			}),
		).toBeNull();
	});
});

describe("legalLinks", () => {
	it("returns the privacy and imprint URLs", () => {
		expect(legalLinks({ ...base, locale: "de", enabled: true })).toEqual({
			privacy: "https://site.test/de/legal/privacy",
			imprint: "https://site.test/de/legal/imprint",
		});
	});

	it("is null when legal pages are disabled", () => {
		expect(legalLinks({ ...base, locale: "en", enabled: false })).toBeNull();
	});

	it("is null without a marketing URL", () => {
		expect(
			legalLinks({
				...base,
				marketingUrl: undefined,
				locale: "en",
				enabled: true,
			}),
		).toBeNull();
	});
});
