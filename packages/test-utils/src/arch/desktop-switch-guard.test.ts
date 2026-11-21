import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Guard: `config.features.desktop` is the one switch for the desktop app,
 * and switched off it costs a buyer nothing at runtime — behaviour-based:
 *
 * - `pnpm dev:desktop` / `pnpm build:desktop` explain the switch and exit 0
 *   without starting anything (no Rust needed);
 * - `pnpm dev` / `pnpm build` (turbo) never reach the desktop app — it has
 *   no `dev` / `build` / `start` script;
 * - the saas / marketing / docs surfaces are covered where they live
 *   (`desktop-surfaces-guard.test.ts`).
 *
 * Skips when apps/desktop was removed (the module is deletable).
 */

const ROOT = join(import.meta.dirname, "../../../../");
const DESKTOP_APP = join(ROOT, "apps/desktop/package.json");
const hasDesktop = existsSync(DESKTOP_APP);
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const sandboxes: string[] = [];
afterAll(() => {
	for (const dir of sandboxes) rmSync(dir, { recursive: true, force: true });
});

/** A repo root whose config has the desktop switch set to `enabled`. */
function sandboxRoot(enabled: boolean): string {
	const dir = mkdtempSync(join(tmpdir(), "desktop-switch-"));
	sandboxes.push(dir);
	writeFileSync(join(dir, "pnpm-workspace.yaml"), "packages: []\n");
	mkdirSync(join(dir, "packages/config"), { recursive: true });
	const config = read("packages/config/index.ts").replace(
		/^(\t\tdesktop: )(true|false),$/m,
		`$1${enabled},`,
	);
	expect(config).toContain(`desktop: ${enabled},`);
	writeFileSync(join(dir, "packages/config/index.ts"), config);
	return dir;
}

function runLauncher(cwd: string, mode: string) {
	return spawnSync(
		process.execPath,
		[join(ROOT, "tooling/scripts/desktop.mjs"), mode],
		{
			cwd,
			encoding: "utf8",
			timeout: 20_000,
			// No pnpm / cargo on PATH: an "off" run must not need them.
			env: { ...process.env, PATH: "" },
		},
	);
}

describe.skipIf(!hasDesktop)("desktop switch (config.features.desktop)", () => {
	it.each(["dev", "build"])(
		"switched off, `%s` explains the switch and exits 0 without starting anything",
		(mode) => {
			const result = runLauncher(sandboxRoot(false), mode);
			expect(result.status).toBe(0);
			expect(result.stdout).toContain("config.features.desktop = false");
		},
	);

	it("switched on without a Rust toolchain, it fails with a hint", () => {
		const root = sandboxRoot(true);
		mkdirSync(join(root, "apps/desktop"), { recursive: true });
		writeFileSync(join(root, "apps/desktop/package.json"), "{}");
		const result = runLauncher(root, "dev");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain("Rust toolchain");
	});

	it("the desktop app has no dev / build / start script (turbo never runs it)", () => {
		const pkg = JSON.parse(readFileSync(DESKTOP_APP, "utf8")) as {
			scripts: Record<string, string>;
		};
		for (const name of ["dev", "build", "start"]) {
			expect(pkg.scripts, name).not.toHaveProperty(name);
		}
	});

	it("root dev:desktop / build:desktop go through the gate", () => {
		const root = JSON.parse(read("package.json")) as {
			scripts: Record<string, string>;
		};
		expect(root.scripts["dev:desktop"]).toBe(
			"node tooling/scripts/desktop.mjs dev",
		);
		expect(root.scripts["build:desktop"]).toBe(
			"node tooling/scripts/desktop.mjs build",
		);
		for (const name of ["dev", "build", "prebuild"]) {
			expect(root.scripts[name], name).not.toMatch(/desktop/);
		}
	});
});
