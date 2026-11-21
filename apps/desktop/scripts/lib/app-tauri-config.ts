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
 * `bundle.macOS.infoPlist` is a path and `bundle.macOS.files` maps bundle
 * paths to source files (Tauri 2.12) — both checked.
 *
 * ```ts
 * import { localizedInfoPlistFiles } from "./macos-info-plist";
 *
 * export const APP_TAURI_CONFIG: AppTauriConfig = {
 *   app: { macOSPrivateApi: true }, // kit Cargo.toml stays unchanged (RELEASING.md)
 *   bundle: {
 *     macOS: {
 *       minimumSystemVersion: "13.0",
 *       // PATH of a plist merged into the app's Info.plist (src-tauri/Info.plist):
 *       //   <key>NSMicrophoneUsageDescription</key><string>Acme records your notes.</string>
 *       infoPlist: "Info.plist",
 *       // Translated prompts: src-tauri/macos/<locale>.lproj/InfoPlist.strings
 *       // ("NSMicrophoneUsageDescription" = "…";) — renderInfoPlistStrings writes one.
 *       files: localizedInfoPlistFiles(["en", "de"]),
 *     },
 *   },
 * };
 * ```
 */

export type AppTauriConfig = { [key: string]: unknown };

export const APP_TAURI_CONFIG: AppTauriConfig = {};
