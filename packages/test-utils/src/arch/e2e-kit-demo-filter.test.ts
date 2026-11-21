import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kit demo E2E specs. Marketing specs tagged `@kit-demo` assert the kit's
 * own demo (landing hero, tour, screenshots, visual baselines): a buyer who
 * replaces the landing page fails them, so they run only with
 * `FUUTU_KIT_SOURCE=1` — kit CI sets it in the kit repository, like
 * `test:kit-source` for the guards. Everything else keeps running.
 */

const ROOT = join(import.meta.dirname, "../../../..");
const lib = await import("../../../../tooling/scripts/playwright-excluded.mjs");

describe("withKitDemoFilter", () => {
	it("adds the tag to grepInvert unless FUUTU_KIT_SOURCE=1", () => {
		const config = lib.withKitDemoFilter({}, {});
		const [grep] = config.grepInvert as RegExp[];
		expect(config.grepInvert).toHaveLength(1);
		expect(grep?.test("chromium landing.spec.ts hero @kit-demo")).toBe(true);
		expect(grep?.test("chromium smoke.spec.ts page loads")).toBe(false);
	});

	it("keeps the app's title exclusions and file ignores next to it", () => {
		const excluded = lib.excludedTestsConfig(["crm.spec.ts", "two-factor"]);
		const config = lib.withKitDemoFilter(excluded, {});
		expect(config.testIgnore).toEqual(["crm.spec.ts"]);
		expect(config.grepInvert).toHaveLength(2);
		expect(
			(config.grepInvert as RegExp[]).some((r) => r.test("auth two-factor")),
		).toBe(true);
	});

	it("is a no-op in the kit repository (FUUTU_KIT_SOURCE=1)", () => {
		const excluded = lib.excludedTestsConfig(["two-factor"]);
		expect(lib.withKitDemoFilter(excluded, { FUUTU_KIT_SOURCE: "1" })).toBe(
			excluded,
		);
		expect(lib.withKitDemoFilter({}, { FUUTU_KIT_SOURCE: "1" })).toEqual({});
	});

	it("treats any other value as unset", () => {
		expect(
			lib.withKitDemoFilter({}, { FUUTU_KIT_SOURCE: "true" }),
		).toHaveProperty("grepInvert");
	});
});

describe("marketing demo specs", () => {
	const DEMO_SPECS = [
		"landing.spec.ts",
		"pricing-ring.spec.ts",
		"visual.spec.ts",
	];
	const present = DEMO_SPECS.filter((file) =>
		existsSync(join(ROOT, "apps/marketing/tests", file)),
	);
	const requireFrom = createRequire(join(ROOT, "apps/marketing/package.json"));
	const playwrightCli = join(
		dirname(requireFrom.resolve("@playwright/test/package.json")),
		"cli.js",
	);

	/** Spec files Playwright would run, one per listed test line. */
	const listedFiles = (kitSource: boolean): Set<string> => {
		const env: NodeJS.ProcessEnv = { ...process.env, CI: "1" };
		delete env.FUUTU_KIT_SOURCE;
		if (kitSource) env.FUUTU_KIT_SOURCE = "1";
		const result = spawnSync(
			process.execPath,
			[playwrightCli, "test", "--list", "--project=chromium"],
			{ cwd: join(ROOT, "apps/marketing"), encoding: "utf8", env },
		);
		expect(result.status, result.stderr).toBe(0);
		return new Set(
			[...result.stdout.matchAll(/› (\S+\.spec\.ts):\d+:\d+ ›/g)].map(
				([, file]) => file ?? "",
			),
		);
	};

	it("every demo spec is skipped without the flag and listed with it", () => {
		const without = listedFiles(false);
		const withFlag = listedFiles(true);
		for (const file of present) {
			expect(without.has(file), `${file} without the flag`).toBe(false);
			expect(withFlag.has(file), `${file} with the flag`).toBe(true);
		}
		expect(without.has("smoke.spec.ts")).toBe(true);
	});

	it("the marketing config applies the filter", () => {
		expect(
			readFileSync(join(ROOT, "apps/marketing/playwright.config.ts"), "utf8"),
		).toMatch(
			/\.\.\.withKitDemoFilter\(excludedTestsConfig\(appExcludedTests\)\)/,
		);
	});
});
