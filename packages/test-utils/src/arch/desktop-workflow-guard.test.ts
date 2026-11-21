import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: the desktop release workflow (.github/workflows/desktop.yml)
 *
 * - pins every action by commit SHA, first-party included;
 * - hands the TAURI_* / APPLE_* signing secrets to the Build step alone
 *   (scripts/run.ts then passes them to `tauri build` only);
 * - never disables build telemetry (LICENSE.md §7).
 *
 * Skips when the workflow was removed with the desktop module.
 */

const ROOT = join(import.meta.dirname, "../../../../");
const WORKFLOW = join(ROOT, ".github/workflows/desktop.yml");
const hasWorkflow = existsSync(WORKFLOW);
const yaml = hasWorkflow ? readFileSync(WORKFLOW, "utf8") : "";

/** Splits the workflow into steps (`- name:` / `- uses:` / `- run:` items). */
function steps(): string[] {
	return yaml
		.split(/\n(?=\s+- (?:name|uses|run|id): )/)
		.filter((s) => /^\s+- /.test(s));
}

describe.skipIf(!hasWorkflow)("desktop release workflow", () => {
	it("pins every action by commit SHA", () => {
		const uses = [...yaml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1] ?? "");
		expect(uses.length).toBeGreaterThan(0);
		expect(uses.filter((u) => !/@[0-9a-f]{40}$/.test(u))).toEqual([]);
	});

	it("gives the TAURI_* / APPLE_* signing secrets to the Build step only", () => {
		const withSigning = steps().filter((s) =>
			/secrets\.(TAURI_|APPLE_)/.test(s),
		);
		expect(withSigning).toHaveLength(1);
		const build = withSigning[0] ?? "";
		expect(build).toMatch(/- name: Build\n/);
		expect(build).toContain("pnpm build:desktop");
		// Not at job or workflow level either.
		const outsideSteps = yaml.replace(build, "");
		expect(outsideSteps).not.toMatch(/secrets\.(TAURI_|APPLE_)/);
	});

	it("keeps build telemetry on", () => {
		expect(yaml).not.toMatch(/^\s*FUUTU_TELEMETRY_DISABLED\s*:/m);
	});
});
