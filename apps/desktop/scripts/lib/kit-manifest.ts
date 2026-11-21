import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

/**
 * The Tauri CLI rewrites the `tauri` dependency features in the kit's
 * src-tauri/Cargo.toml to match the config (`app.macOSPrivateApi` →
 * `macos-private-api`, …; tauri-utils `AppConfig::all_features` minus
 * `tray-icon`). A buyer enabling one in app-tauri-config.ts would see a
 * kit file change, so `pnpm dev:desktop` / `pnpm build:desktop` put the
 * manifest back after the CLI ran (and at the next start, after a crash).
 * Only that rewrite is reverted; any other edit is left alone. CI fails
 * when a build leaves the file changed.
 */
export const CLI_MANAGED_TAURI_FEATURES = [
	"macos-private-api",
	"protocol-asset",
	"isolation",
] as const;

const TAURI_LINE = /^tauri\s*=\s*\{(.*)\}\s*$/;

function features(line: string): { rest: string; list: string[] } | null {
	const match = TAURI_LINE.exec(line);
	if (!match?.[1]) return null;
	const body = match[1];
	const array = /features\s*=\s*\[([^\]]*)\]/.exec(body);
	const list = array?.[1]
		? [...array[1].matchAll(/"([^"]+)"/g)].map((m) => m[1] ?? "")
		: [];
	return {
		rest: body
			.replace(/features\s*=\s*\[[^\]]*\]/, "features")
			.replace(/\s+/g, ""),
		list,
	};
}

/**
 * The original manifest when `current` differs from it only by the CLI's
 * managed-feature rewrite of the `tauri` line, else `null` (unchanged, or
 * changed otherwise — left alone).
 */
export function revertCliFeatureRewrite(
	original: string,
	current: string,
): string | null {
	if (original === current) return null;
	const a = original.split("\n");
	const b = current.split("\n");
	if (a.length !== b.length) return null;
	const managed: readonly string[] = CLI_MANAGED_TAURI_FEATURES;
	for (let i = 0; i < a.length; i++) {
		const before = a[i] ?? "";
		const after = b[i] ?? "";
		if (before === after) continue;
		const x = features(before);
		const y = features(after);
		if (!x || !y || x.rest !== y.rest) return null;
		const changed = [
			...x.list.filter((f) => !y.list.includes(f)),
			...y.list.filter((f) => !x.list.includes(f)),
		];
		if (!changed.every((f) => managed.includes(f))) return null;
	}
	return original;
}

/** Remembers the kit manifest before the CLI runs (`restoreKitManifest` puts it back). */
export function kitManifestGuard(tauriDir: string) {
	const manifest = join(tauriDir, "Cargo.toml");
	const backup = join(tauriDir, "target/kit-cargo-toml.backup");
	const restore = () => {
		if (!existsSync(backup)) return;
		const original = readFileSync(backup, "utf8");
		const reverted = revertCliFeatureRewrite(
			original,
			readFileSync(manifest, "utf8"),
		);
		if (reverted !== null) writeFileSync(manifest, reverted);
		rmSync(backup, { force: true });
	};
	return {
		guard() {
			restore(); // a previous run that died before restoring
			mkdirSync(dirname(backup), { recursive: true });
			writeFileSync(backup, readFileSync(manifest, "utf8"));
		},
		restore,
	};
}
