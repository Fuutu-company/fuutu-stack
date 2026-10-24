import { describe, expect, it, vi } from "vitest";
import { isValidLocale } from "../../lib/locale-utils";
import { getFallbackChain, getMessagesForLocale } from "../../lib/messages";

// Stub the de `common` bundle down to a single key so the tests can prove
// missing de keys fall back to en — the real de bundle is at full parity.
vi.mock("../../translations/de/common/index", () => ({
	default: { common: { probeDeOnly: "de-probe" } },
}));

describe("getFallbackChain()", () => {
	it("returns only the default locale for en", () => {
		expect(getFallbackChain("en")).toEqual(["en"]);
	});

	it("follows the configured fallbackLocale", () => {
		expect(getFallbackChain("de")).toEqual(["de", "en"]);
	});

	it("inserts a configured BCP-47 parent before the default", () => {
		expect(getFallbackChain("de-AT")).toEqual(["de-AT", "de", "en"]);
	});

	it("walks up to the nearest configured parent for multi-subtag locales", () => {
		expect(getFallbackChain("de-AT-x")).toEqual(["de-AT-x", "de", "en"]);
	});

	it("skips an unconfigured parent and falls straight to the default", () => {
		expect(getFallbackChain("fr-CA")).toEqual(["fr-CA", "en"]);
	});

	it("does not duplicate defaultLocale when it sits inside the chain", () => {
		// Regression: a buyer sets defaultLocale "de" with de → en. The inner
		// frame must not re-append "de", or the chain becomes ["de","en","de"],
		// dedupes to ["de","en"] and en would override de in the merge.
		const germanDefault = {
			locales: {
				de: { fallbackLocale: "en" },
				en: {},
			},
			defaultLocale: "de",
		};
		expect(getFallbackChain("de", germanDefault)).toEqual(["de", "en"]);
		expect(getFallbackChain("en", germanDefault)).toEqual(["en", "de"]);
	});

	it("terminates on a two-locale fallbackLocale cycle", () => {
		const cyclic = {
			locales: {
				a: { fallbackLocale: "b" },
				b: { fallbackLocale: "a" },
			},
			defaultLocale: "en",
		};
		expect(getFallbackChain("a", cyclic)).toEqual(["a", "b", "en"]);
		expect(getFallbackChain("b", cyclic)).toEqual(["b", "a", "en"]);
	});

	it("terminates on a self-referencing fallbackLocale", () => {
		const cyclic = {
			locales: { a: { fallbackLocale: "a" } },
			defaultLocale: "en",
		};
		expect(getFallbackChain("a", cyclic)).toEqual(["a", "en"]);
	});
});

describe("getMessagesForLocale() merging", () => {
	it("falls back to en for keys missing in the requested locale", async () => {
		const messages = await getMessagesForLocale("de", "saas");
		// `probeDeOnly` only exists in the stubbed de bundle; `loading` only in en.
		expect(messages.common as Record<string, unknown>).toMatchObject({
			probeDeOnly: "de-probe",
			loading: "Loading...",
		});
	});

	it("lets the requested locale win over the fallback", async () => {
		const messages = await getMessagesForLocale("de", "saas");
		expect(messages.auth.signIn).toBe("Anmelden");
	});

	it("replaces arrays instead of concatenating them", async () => {
		const messages = await getMessagesForLocale("de", "marketing");
		expect(messages.home.faq.categories).toHaveLength(3);
		expect(messages.home.faq.categories[0]?.label).toBe("Lizenz");
	});

	it("resolves a BCP-47 parent before the default — de-AT merges de over en", async () => {
		const messages = await getMessagesForLocale("de-AT", "saas");
		expect(messages.auth.signIn).toBe("Anmelden");
	});

	it("dedupes an invalid locale down to the default bundle", async () => {
		const messages = await getMessagesForLocale("fr", "saas");
		const en = await getMessagesForLocale("en", "saas");
		expect(messages).toEqual(en);
	});
});

describe("isValidLocale() prototype safety", () => {
	it.each(["__proto__", "constructor", "hasOwnProperty", "toString"])(
		"returns false for %s",
		(locale) => {
			expect(isValidLocale(locale)).toBe(false);
		},
	);
});
