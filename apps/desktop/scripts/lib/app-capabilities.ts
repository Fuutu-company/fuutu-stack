/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Extra Tauri capabilities (permissions) of your app — e.g. a plugin's
 * commands, file-system scopes, your own Rust commands' permissions.
 * `buildTauriConfig` (scripts/lib/tauri-config.ts) appends them to the
 * kit's `default` capability in dev and release builds (dev: before the
 * devtools capability). Each entry is an inline capability or the
 * identifier of a file in `src-tauri/capabilities/`.
 *
 * ```ts
 * export const APP_CAPABILITIES: AppCapability[] = [
 *   {
 *     identifier: "app-files",
 *     windows: ["main"],
 *     permissions: ["fs:allow-read-text-file"],
 *   },
 * ];
 * ```
 *
 * https://v2.tauri.app/security/capabilities/
 */

export type AppCapability =
	| string
	| {
			identifier: string;
			description?: string;
			windows?: string[];
			webviews?: string[];
			platforms?: ("macOS" | "windows" | "linux")[];
			permissions: (string | Record<string, unknown>)[];
	  };

export const APP_CAPABILITIES: AppCapability[] = [];
