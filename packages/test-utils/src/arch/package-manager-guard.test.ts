import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `minimumReleaseAge` in pnpm-workspace.yaml (supply-chain delay for fresh
 * releases) only exists from pnpm 10.16.0 — older pnpm ignores it silently.
 * `packageManager` is the one pin: CI's pnpm/action-setup and the
 * Dockerfiles' corepack both follow it.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (path: string) => readFileSync(join(REPO_ROOT, path), "utf-8");

describe("package manager guard", () => {
	const { packageManager } = JSON.parse(read("package.json")) as {
		packageManager?: string;
	};

	it("pins a pnpm 10 release that enforces minimumReleaseAge", () => {
		const match = packageManager?.match(/^pnpm@(\d+)\.(\d+)\.(\d+)$/);
		expect(match).not.toBeNull();
		const [major, minor] = [Number(match?.[1]), Number(match?.[2])];
		expect(major).toBe(10);
		expect(minor).toBeGreaterThanOrEqual(16);
		expect(read("pnpm-workspace.yaml")).toMatch(/^minimumReleaseAge: \d+/m);
	});

	it("CI takes the pnpm version from packageManager", () => {
		const setup = read(".github/actions/setup/action.yml");
		const step = setup.slice(setup.indexOf("- uses: pnpm/action-setup@"));
		expect(step.slice(0, step.indexOf("\n    - "))).not.toMatch(/version:/);
	});
});
