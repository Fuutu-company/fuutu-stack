/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Programs your app bundles next to its binary (Tauri sidecars,
 * https://v2.tauri.app/develop/sidecar/).
 *
 * - `APP_EXTERNAL_BIN`: paths relative to `src-tauri/`, without the
 *   target-triple suffix (`binaries/ffmpeg` → ship
 *   `binaries/ffmpeg-aarch64-apple-darwin`, …). They go to
 *   `bundle.externalBin` in release builds (`pnpm build:desktop`).
 * - `shippedSidecars()`: one entry per bundled program for the
 *   third-party notices (About → Licences) and the licence gate
 *   (`scripts/licenses.mjs`, same allowlist as npm packages). Every entry
 *   needs `name`, `version`, `license` (SPDX) and `text` (the licence
 *   text); `repository` is optional.
 *
 * ```js
 * export const APP_EXTERNAL_BIN = ["binaries/helper"];
 * export function shippedSidecars() {
 *   return [{ name: "helper", version: "1.2.0", license: "MIT",
 *     text: readFileSync(new URL("../../src-tauri/binaries/LICENSE-helper", import.meta.url), "utf8") }];
 * }
 * ```
 */

/** @type {string[]} */
export const APP_EXTERNAL_BIN = [];

/** @returns {import("./app-sidecars.mjs").SidecarNotice[]} */
export function shippedSidecars() {
	return [];
}
