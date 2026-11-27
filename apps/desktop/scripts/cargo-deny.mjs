#!/usr/bin/env node
/**
 * `cargo deny check` with the kit policy (src-tauri/deny.toml) plus the
 * app's crate exceptions (app-owned src-tauri/deny.app.toml), merged into
 * src-tauri/target/deny.generated.toml. CI and local checks run this
 * instead of `cargo deny check`; arguments pass through.
 *
 *   node scripts/cargo-deny.mjs [licenses|advisories|bans|sources]
 *
 * deny.app.toml may only add tables of `[[licenses.exceptions]]`,
 * `[[advisories.ignore]]` and `[[bans.skip]]` — the policy itself (allowed
 * licences, sources, advisory levels) stays the kit's.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const tauriDir = join(dirname(fileURLToPath(import.meta.url)), "../src-tauri");

const APP_TABLES = new Set([
	"[[licenses.exceptions]]",
	"[[advisories.ignore]]",
	"[[bans.skip]]",
]);

/** The kit policy with the app's exception tables appended; throws on anything else. */
export function denyConfig(kit, app) {
	let inTable = false;
	// CRLF too: Windows checkouts (core.autocrlf) end lines with \r\n.
	app.split(/\r?\n/).forEach((raw, index) => {
		const line = raw.replace(/#.*$/, "").trim();
		if (!line) return;
		if (line.startsWith("[")) {
			if (!APP_TABLES.has(line)) {
				throw new Error(
					`deny.app.toml:${index + 1}: only ${[...APP_TABLES].join(", ")} tables are allowed, not ${line}`,
				);
			}
			inTable = true;
			return;
		}
		if (!inTable) {
			throw new Error(
				`deny.app.toml:${index + 1}: keys belong in an exception table (${[...APP_TABLES].join(", ")})`,
			);
		}
	});
	return `${kit.trimEnd()}\n\n# --- deny.app.toml (app-owned) ---\n${app.trim()}\n`;
}

/**
 * Message when `cargo deny` cannot run (`run` probes
 * `cargo deny --version`), else null: cargo itself missing (spawn error,
 * no exit status) or the cargo-deny subcommand missing.
 */
export function cargoDenyMissing(
	run = () => spawnSync("cargo", ["deny", "--version"], { stdio: "ignore" }),
) {
	const result = run();
	if (result.status === 0) return null;
	if (result.error || result.status === null) {
		return "cargo not found on PATH (install Rust via rustup, or add ~/.cargo/bin to PATH)";
	}
	return "cargo-deny is not installed. Install it with: cargo install cargo-deny --locked";
}

function main() {
	const missing = cargoDenyMissing();
	if (missing) {
		process.stderr.write(`${missing}\n`);
		process.exit(1);
	}
	const kit = readFileSync(join(tauriDir, "deny.toml"), "utf8");
	const appFile = join(tauriDir, "deny.app.toml");
	const app = existsSync(appFile) ? readFileSync(appFile, "utf8") : "";
	const out = join(tauriDir, "target/deny.generated.toml");
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, denyConfig(kit, app));
	const result = spawnSync(
		"cargo",
		["deny", "--config", out, "check", ...process.argv.slice(2)],
		{ cwd: tauriDir, stdio: "inherit" },
	);
	process.exit(result.status ?? 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
