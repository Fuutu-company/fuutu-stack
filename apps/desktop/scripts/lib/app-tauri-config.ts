/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Your keys of the Tauri config (https://v2.tauri.app/reference/config/),
 * deep-merged into the generated `tauri.<mode>.generated.json` in dev and
 * release builds (`buildTauriConfig`, scripts/lib/tauri-config.ts):
 * objects merge key by key, arrays and values replace the kit's.
 *
 * Refused (the build fails): identity (`identifier`, `productName`,
 * `version`, `mainBinaryName`), `build`, `app.security` (CSP,
 * capabilities — use app-capabilities.ts), `app.withGlobalTauri`, the
 * updater and deep-link plugins, `bundle.createUpdaterArtifacts`,
 * `bundle.externalBin` (use app-sidecars.mjs) and the signing keys
 * (`bundle.windows.certificateThumbprint` / `signCommand`,
 * `bundle.macOS.signingIdentity`). The `main` window must stay.
 *
 * ```ts
 * export const APP_TAURI_CONFIG: AppTauriConfig = {
 *   app: { macOSPrivateApi: true },
 *   bundle: {
 *     macOS: {
 *       minimumSystemVersion: "13.0",
 *       // Permission prompts (English); translations: one
 *       // `<locale>.lproj/InfoPlist.strings` per locale via `files`.
 *       infoPlist: { NSMicrophoneUsageDescription: "Acme records your voice notes." },
 *       files: { "Resources/de.lproj/InfoPlist.strings": "./macos/de.lproj/InfoPlist.strings" },
 *     },
 *   },
 * };
 * ```
 */

export type AppTauriConfig = { [key: string]: unknown };

export const APP_TAURI_CONFIG: AppTauriConfig = {};
