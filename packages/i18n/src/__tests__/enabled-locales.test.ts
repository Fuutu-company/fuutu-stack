import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { i18nConfig } from "../../config";
import { namespaceLoaders } from "../../lib/messages";
import {
	parseConfiguredLocales,
	partitionLocaleDirs,
} from "../../scripts/locales.mjs";

const here = dirname(fileURLToPath(import.meta.url));

const singleLocaleSource = `
/**
 * Doc comment mentioning locales: { fake: {} } must be ignored.
 */
export const i18nConfig = {
	enabled: true,
	// locales: { nope: {} }
	locales: {
		en: {
			currency: "USD",
			label: "English // not a comment",
			direction: "ltr",
		},
	},
	defaultLocale: "en",
} as const;
`;

const quotedKeySource = `export const i18nConfig = {
	locales: {
		en: { label: "English" },
		"pt-BR": { label: "Português", fallbackLocale: "en" },
		de: { label: "Deutsch", nested: { deep: { x: 1 } } },
	},
	defaultLocale: "en",
} as const;`;

describe("parseConfiguredLocales()", () => {
	it("returns exactly the enabled locale for a single-locale config", () => {
		expect(parseConfiguredLocales(singleLocaleSource)).toEqual(["en"]);
	});

	it("handles quoted keys and nested objects inside entries", () => {
		expect(parseConfiguredLocales(quotedKeySource)).toEqual([
			"en",
			"pt-BR",
			"de",
		]);
	});

	it("returns null when no locales block can be found", () => {
		expect(parseConfiguredLocales("export const x = 1;")).toBeNull();
	});

	it("agrees with the real i18nConfig import", () => {
		const source = readFileSync(resolve(here, "../../config.ts"), "utf-8");
		expect(parseConfiguredLocales(source)).toEqual(
			Object.keys(i18nConfig.locales),
		);
	});
});

describe("partitionLocaleDirs()", () => {
	it("treats folders that are not enabled as dormant, not as enabled", () => {
		expect(partitionLocaleDirs(["de", "en"], ["en"])).toEqual({
			enabled: ["en"],
			dormant: ["de"],
			missing: [],
		});
	});

	it("reports an enabled locale without a folder as missing", () => {
		expect(partitionLocaleDirs(["en"], ["en", "fr"])).toEqual({
			enabled: ["en"],
			dormant: [],
			missing: ["fr"],
		});
	});

	it("checks every enabled locale when several are configured", () => {
		expect(partitionLocaleDirs(["de", "en", "fr"], ["en", "de"])).toEqual({
			enabled: ["de", "en"],
			dormant: ["fr"],
			missing: [],
		});
	});
});

describe("real i18nConfig", () => {
	const enabled = Object.keys(i18nConfig.locales);

	it("enables the default locale", () => {
		expect(enabled).toContain(i18nConfig.defaultLocale);
	});

	it.each(enabled)("%s has loaders and a translations folder", (locale) => {
		expect(namespaceLoaders[locale]).toBeDefined();
		expect(existsSync(resolve(here, "../../translations", locale))).toBe(true);
	});

	it.each(enabled)(
		"%s fallbackLocale points at an enabled locale",
		(locale) => {
			const entry: object =
				i18nConfig.locales[locale as keyof typeof i18nConfig.locales];
			const fallback = "fallbackLocale" in entry ? entry.fallbackLocale : null;
			if (typeof fallback === "string") expect(enabled).toContain(fallback);
		},
	);
});
