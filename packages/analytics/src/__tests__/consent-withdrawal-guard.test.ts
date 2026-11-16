import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { consentWithdrawalStrategy } from "../consent-withdrawal";
import * as analytics from "../index";
import type { AnalyticsProvider } from "../types";

/**
 * Guard: withdrawing consent must stop an analytics script that is
 * already loaded. Every exported provider that injects a script
 * (`getScriptProps`) either implements `installConsentGate` (the script
 * asks before every send) or is covered by the reload path in
 * <AnalyticsScript />, which reloads the page so the script is gone.
 */

const SCRIPT_FILE = join(import.meta.dirname, "../script.tsx");

function isProvider(value: unknown): value is AnalyticsProvider {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as AnalyticsProvider).id === "string" &&
		typeof (value as AnalyticsProvider).trackEvent === "function"
	);
}

const providers = Object.values(analytics as Record<string, unknown>).filter(
	isProvider,
);

describe("analytics consent withdrawal guard", () => {
	it("finds the exported providers", () => {
		expect(providers.map((p) => p.id)).toContain("umami");
	});

	it("every script provider has a consent gate or is covered by the reload path", () => {
		const uncovered = providers
			.filter((p) => typeof p.getScriptProps === "function")
			.filter(
				(p) =>
					typeof p.installConsentGate !== "function" &&
					consentWithdrawalStrategy(p) !== "reload",
			)
			.map((p) => p.id);
		expect(uncovered).toEqual([]);
	});

	it("<AnalyticsScript /> reloads the page when the reload path says so", () => {
		const source = readFileSync(SCRIPT_FILE, "utf8");
		expect(source).toMatch(/needsReloadOnConsentChange\(/);
		expect(source).toMatch(/location\.reload\(\)/);
	});
});
