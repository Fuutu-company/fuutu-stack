#!/usr/bin/env node
/**
 * Entry point of `pnpm dev:desktop` / `pnpm build:desktop`.
 *
 * Gate only: with `config.features.desktop` off it explains how to turn the
 * desktop app on and exits 0 — nothing else runs and no Rust toolchain is
 * needed. With the switch on it checks for `cargo` and hands over to the
 * desktop app's launcher (`apps/desktop/scripts/run.ts`).
 *
 *   node tooling/scripts/desktop.mjs dev     # Tauri dev window on the port slot
 *   node tooling/scripts/desktop.mjs build   # signed release bundles
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { findRoot } from "../ports/index.mjs";

const MODES = new Set(["dev", "build"]);

/** Reads `config.features.desktop` (Node strips the TypeScript types). */
export async function isDesktopEnabled(root) {
	const { config } = await import(
		pathToFileURL(join(root, "packages/config/index.ts")).href
	);
	return config.features.desktop === true;
}

async function main() {
	const [mode, ...rest] = process.argv.slice(2);
	if (!MODES.has(mode)) {
		process.stderr.write("usage: desktop.mjs <dev|build> [tauri args]\n");
		process.exit(1);
	}
	const root = findRoot();
	if (!(await isDesktopEnabled(root))) {
		process.stdout.write(
			"\n  The desktop app is off (config.features.desktop = false in packages/config/index.ts).\n" +
				"  Turn it on there to use `pnpm dev:desktop` / `pnpm build:desktop` (needs a Rust toolchain).\n\n",
		);
		process.exit(0);
	}
	if (!existsSync(join(root, "apps/desktop/package.json"))) {
		process.stderr.write("\n  apps/desktop is missing.\n\n");
		process.exit(1);
	}
	const cargo = spawnSync("cargo", ["--version"], { stdio: "ignore" });
	if (cargo.status !== 0) {
		process.stderr.write(
			"\n  The desktop app needs a Rust toolchain: https://rustup.rs (then re-run).\n\n",
		);
		process.exit(1);
	}
	const child = spawn(
		"pnpm",
		[
			"-F",
			"@fuutu/desktop-app",
			"exec",
			"tsx",
			"scripts/run.ts",
			mode,
			...rest,
		],
		{ cwd: root, stdio: "inherit" },
	);
	child.on("exit", (code, signal) => {
		if (signal) process.kill(process.pid, signal);
		process.exit(code ?? 0);
	});
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	await main();
}
