#!/usr/bin/env node
/**
 * Proves the agent automation bridge is absent from release builds.
 *
 *   node scripts/check-release-clean.mjs            # dependency graph check
 *   node scripts/check-release-clean.mjs <binary>   # + scan a built binary
 *
 * 1. `cargo tree` for a release build (default features) must not contain
 *    `tauri-plugin-mcp-bridge`.
 * 2. A built binary must not contain the bridge's marker strings.
 * (3. `src-tauri/src/lib.rs` refuses to compile `--release --features devtools`.)
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const tauriDir = join(dirname(fileURLToPath(import.meta.url)), "../src-tauri");
export const BRIDGE_CRATE = "tauri-plugin-mcp-bridge";
export const BINARY_MARKERS = [
	"x-fuutu-bridge-token",
	"MCP Bridge plugin initialized",
	"mcp-bridge",
];

export function releaseTreeHasBridge() {
	const tree = spawnSync(
		"cargo",
		["tree", "--edges", "normal,build", "--prefix", "none", "--target", "all"],
		{ cwd: tauriDir, encoding: "utf8" },
	);
	if (tree.status !== 0) throw new Error(`cargo tree failed:\n${tree.stderr}`);
	return tree.stdout
		.split("\n")
		.some((line) => line.startsWith(`${BRIDGE_CRATE} `));
}

export function binaryMarkers(file) {
	const bytes = readFileSync(file);
	return BINARY_MARKERS.filter((marker) => bytes.includes(Buffer.from(marker)));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	let failed = false;
	if (releaseTreeHasBridge()) {
		console.error(`✗ ${BRIDGE_CRATE} is in the release dependency graph`);
		failed = true;
	} else console.log(`✓ ${BRIDGE_CRATE} not in the release dependency graph`);
	const binary = process.argv[2];
	if (binary) {
		const found = binaryMarkers(binary);
		if (found.length) {
			console.error(`✗ ${binary} contains bridge markers: ${found.join(", ")}`);
			failed = true;
		} else console.log(`✓ ${binary} contains no bridge markers`);
	}
	process.exit(failed ? 1 : 0);
}
