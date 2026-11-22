/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Inputs of the desktop workflow (`.github/workflows/desktop.yml`), so the
 * workflow itself stays kit-owned (`scripts/ci-inputs.mjs` reads them in
 * the gate job):
 *
 * - `LINUX_RUNNER`: GitHub runner image for the Rust checks and the Linux
 *   build, e.g. `"ubuntu-24.04"` when a dependency needs newer system
 *   libraries.
 * - `LINUX_APT_PACKAGES`: apt packages installed next to the kit's webview
 *   dependencies in both Linux jobs (system libraries your Rust crates or
 *   sidecars link against).
 *
 * Linux bundle formats live in `desktopConfig.release.linuxFormats`
 * (`@fuutu/desktop/config`).
 */

export const LINUX_RUNNER = "ubuntu-22.04";

/** @type {string[]} */
export const LINUX_APT_PACKAGES = [];
