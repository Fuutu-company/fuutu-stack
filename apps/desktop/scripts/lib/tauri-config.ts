import { desktopIdentity } from "@fuutu/desktop/identity";

/** Mode the generated Tauri config is for. */
export type TauriConfigMode = "dev" | "build";

export type TauriConfigInput = {
	mode: TauriConfigMode;
	/** YOUR app version (root package.json, `APP_VERSION`). */
	appVersion: string;
	/** Dev server URL on the port slot (dev only). */
	devUrl?: string;
};

/** Capability that lets the debug-only automation bridge talk to the webviews. */
export const DEVTOOLS_CAPABILITY = {
	identifier: "devtools",
	description:
		"Debug builds only: agent automation bridge (check-in-desktop skill).",
	windows: ["*"],
	permissions: ["mcp-bridge:default"],
} as const;

/**
 * Config merged over `src-tauri/tauri.conf.json` (`tauri --config`): every
 * name comes from `config.app` via `@fuutu/desktop/identity`, the version
 * from the root package.json. Release builds never get the devtools
 * capability or the global Tauri object.
 */
export function buildTauriConfig(input: TauriConfigInput) {
	const id = desktopIdentity;
	const dev = input.mode === "dev";
	return {
		productName: id.productName,
		version: input.appVersion,
		identifier: id.bundleId,
		build: dev
			? { devUrl: input.devUrl, beforeDevCommand: "" }
			: { beforeBuildCommand: "" },
		app: {
			withGlobalTauri: dev,
			windows: [
				{
					label: "main",
					title: id.productName,
					width: 1100,
					height: 720,
					minWidth: 720,
					minHeight: 480,
				},
			],
			security: {
				capabilities: dev ? ["default", DEVTOOLS_CAPABILITY] : ["default"],
			},
		},
	};
}
