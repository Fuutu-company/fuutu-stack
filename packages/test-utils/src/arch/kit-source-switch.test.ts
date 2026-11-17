import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Two classes of architecture guards:
 * - `src/arch/*.test.ts` — kit invariants. They hold in any app built on
 *   the kit and run in every `pnpm test`, the buyer's included.
 * - `src/arch/kit-source/*.test.ts` — guards on the kit's own demo source
 *   and kit-repo files. A buyer who rewrites the UI breaks them, so
 *   `pnpm test` leaves them out; `pnpm -F @fuutu/test-utils test:kit-source`
 *   runs them, and the kit's CI does so in the kit repository only.
 */

const PKG = join(import.meta.dirname, "../..");
const KIT_SOURCE_DIR = "src/arch/kit-source/";
const VITEST_BIN = join(
	dirname(
		createRequire(join(PKG, "package.json")).resolve("vitest/package.json"),
	),
	"vitest.mjs",
);

/** Test files a vitest config collects, relative to the package. */
function listFiles(config: string): string[] {
	const env = { ...process.env };
	for (const key of Object.keys(env)) {
		if (key.startsWith("VITEST")) delete env[key];
	}
	const result = spawnSync(
		process.execPath,
		[VITEST_BIN, "list", "--filesOnly", "--config", config],
		{ cwd: PKG, encoding: "utf8", env },
	);
	expect(result.status, result.stderr).toBe(0);
	return result.stdout
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.endsWith(".test.ts"));
}

describe("kit-source guards switch", () => {
	it("pnpm test (the buyer's run) collects the invariants, no kit-source guard", () => {
		const files = listFiles("vitest.config.ts");
		expect(files).toContain("src/arch/kit-source-switch.test.ts");
		expect(files).toContain("src/arch/db-access-guard.test.ts");
		expect(files.filter((file) => file.startsWith(KIT_SOURCE_DIR))).toEqual([]);
	});

	it("test:kit-source collects only the kit-source guards, and finds some", () => {
		const files = listFiles("vitest.kit-source.config.ts");
		expect(files.length).toBeGreaterThan(0);
		expect(files.filter((file) => !file.startsWith(KIT_SOURCE_DIR))).toEqual(
			[],
		);
	});

	it("test:kit-source fails when it finds no guard (no silent green)", () => {
		const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
			scripts: Record<string, string>;
		};
		expect(pkg.scripts["test:kit-source"]).toBe(
			"vitest run --config vitest.kit-source.config.ts",
		);
		const config = readFileSync(
			join(PKG, "vitest.kit-source.config.ts"),
			"utf8",
		);
		expect(config).toMatch(/passWithNoTests: false/);
	});
});
