import { CREDIT_METERS } from "@fuutu/credits/meters";
import { CREDIT_TOPUPS } from "@fuutu/payments/config";
import { describe, expect, it } from "vitest";
import { importLocale } from "../../lib/messages";
import deCredits from "../../translations/de/saas/credits.json";
import enCredits from "../../translations/en/saas/credits.json";

const METER_KEYS = CREDIT_METERS.map((meter) => meter.key);
const TOPUP_IDS = CREDIT_TOPUPS.map((topup) => topup.id);

function keySet(value: unknown, prefix = ""): string[] {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		return [prefix];
	}
	return Object.entries(value as Record<string, unknown>).flatMap(
		([key, child]) => keySet(child, prefix === "" ? key : `${prefix}.${key}`),
	);
}

describe("credits translations", () => {
	it("en and de credits namespaces have identical key sets", () => {
		expect(keySet(deCredits.credits).sort()).toEqual(
			keySet(enCredits.credits).sort(),
		);
	});

	it.each(["en", "de"] as const)(
		"%s: every configured meter has a label",
		async (locale) => {
			const messages = await importLocale(locale, "saas");
			for (const meterKey of METER_KEYS) {
				expect(messages.credits).toHaveProperty(
					`meters.${meterKey}`,
					expect.any(String),
				);
			}
		},
	);

	it.each(["en", "de"] as const)(
		"%s: every configured top-up package has label and description",
		async (locale) => {
			const messages = await importLocale(locale, "saas");
			for (const id of TOPUP_IDS) {
				expect(messages.credits.topup).toHaveProperty(
					`packages.${id}.label`,
					expect.any(String),
				);
				expect(messages.credits.topup).toHaveProperty(
					`packages.${id}.description`,
					expect.any(String),
				);
			}
		},
	);
});
