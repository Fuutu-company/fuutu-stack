#!/usr/bin/env node
/**
 * Builds the app's sidecar programs for one target — calls `build()` of
 * the app-owned scripts/lib/app-sidecars.mjs when it exports one, else
 * does nothing. The desktop workflow runs it per matrix job before
 * `pnpm build:desktop`, without any secret.
 *
 *   node scripts/build-sidecars.mjs <rust-target-triple>
 *
 * Tauri expects `<path>-<target triple>` next to each APP_EXTERNAL_BIN
 * entry (`binaries/helper-aarch64-apple-darwin`; universal macOS builds:
 * `-universal-apple-darwin`).
 */
import { pathToFileURL } from "node:url";

/** True when the app's `build()` ran. */
export async function buildSidecars(sidecars, { target }) {
	if (typeof sidecars.build !== "function") return false;
	await sidecars.build({ target });
	return true;
}

async function main() {
	const [target] = process.argv.slice(2);
	if (!target) {
		console.error("usage: build-sidecars.mjs <rust-target-triple>");
		process.exit(1);
	}
	const sidecars = await import("./lib/app-sidecars.mjs");
	const built = await buildSidecars(sidecars, { target });
	console.log(
		built
			? `sidecars built for ${target}`
			: "no sidecars to build (app-sidecars.mjs exports no build())",
	);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
