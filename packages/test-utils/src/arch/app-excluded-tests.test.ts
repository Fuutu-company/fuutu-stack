import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * App-excluded E2E tests (`apps/{saas,marketing}/tests/app-excluded.ts`):
 * file globs become Playwright `testIgnore`, other entries title filters
 * in `grepInvert`. An empty list adds neither, so the kit configs run
 * exactly as before; CLI `--grep-invert` (CI) is a separate filter and
 * still applies on top.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const lib = await import("../../../../tooling/scripts/playwright-excluded.mjs");

describe("excludedTestsConfig", () => {
	it("adds nothing for an empty list", () => {
		expect(lib.excludedTestsConfig([])).toEqual({});
	});

	it("routes file globs to testIgnore", () => {
		expect(
			lib.excludedTestsConfig(["chat.spec.ts", "**/crm*.spec.ts", "legacy/**"]),
		).toEqual({
			testIgnore: ["chat.spec.ts", "**/crm*.spec.ts", "legacy/**"],
		});
	});

	it("routes titles to a literal grepInvert pattern", () => {
		const config = lib.excludedTestsConfig([
			"Billing (Pro plan)",
			"sidebar › org",
			"GET /api/version",
		]);
		expect(config.testIgnore).toBeUndefined();
		const grep = config.grepInvert as RegExp;
		expect(grep.test("smoke GET /api/version returns 200")).toBe(true);
		expect(grep.test("Billing (Pro plan) › checkout")).toBe(true);
		expect(grep.test("dashboard sidebar › org switcher")).toBe(true);
		expect(grep.test("Billing Pro plan")).toBe(false);
		expect(grep.test("dashboard")).toBe(false);
	});

	it("drops empty and whitespace-only entries instead of matching everything", () => {
		expect(lib.excludedTestsConfig(["", "  ", "\t"])).toEqual({});
		const config = lib.excludedTestsConfig(["", "two-factor", " "]);
		const grep = config.grepInvert as RegExp;
		expect(grep.test("auth two-factor")).toBe(true);
		expect(grep.test("dashboard")).toBe(false);
	});

	it("splits a mixed list", () => {
		const config = lib.excludedTestsConfig(["mcp.spec.ts", "two-factor"]);
		expect(config.testIgnore).toEqual(["mcp.spec.ts"]);
		expect((config.grepInvert as RegExp).test("auth two-factor")).toBe(true);
	});
});

describe("playwright configs", () => {
	for (const app of ["saas", "marketing"]) {
		it(`apps/${app} spreads the app exclusions into its config`, () => {
			const config = readFileSync(
				join(ROOT, `apps/${app}/playwright.config.ts`),
				"utf8",
			);
			expect(config).toMatch(
				/from "\.\.\/\.\.\/tooling\/scripts\/playwright-excluded\.mjs"/,
			);
			expect(config).toMatch(/\.\.\.excludedTestsConfig\(appExcludedTests\)/);
		});
	}
});
