import { desktopConfig } from "@fuutu/desktop/config";
import { desktopIdentity } from "@fuutu/desktop/identity";

/** Mode the generated Tauri config is for. */
export type TauriConfigMode = "dev" | "build";

export type TauriConfigInput = {
	mode: TauriConfigMode;
	/** YOUR app version (root package.json, `APP_VERSION`). */
	appVersion: string;
	/** Dev server URL on the port slot (dev only). */
	devUrl?: string;
	/** saas origin the app talks to (`NEXT_PUBLIC_SAAS_URL`). */
	saasUrl?: string;
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
 * Release CSP: only the app bundle, Tauri IPC and the saas backend. Tauri
 * adds hashes for the export's inline scripts at build time.
 */
export function releaseCsp(saasUrl?: string): string {
	const backend = saasUrl ? ` ${new URL(saasUrl).origin}` : "";
	return [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		`connect-src 'self' ipc: http://ipc.localhost${backend}`,
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'none'",
		"frame-ancestors 'none'",
	].join("; ");
}

/**
 * Desktop behaviour the Rust side needs at startup — embedded at compile
 * time via `FUUTU_DESKTOP_CONFIG` (src-tauri/src/config.rs).
 */
export function desktopRuntimeConfig(saasUrl?: string) {
	return {
		shell: desktopConfig.shell,
		identity: {
			productName: desktopIdentity.productName,
			scheme: desktopIdentity.scheme,
			oauthClientId: desktopIdentity.oauthClientId,
			keychainService: desktopIdentity.keychainService,
		},
		auth: desktopConfig.auth,
		offlineGraceDays: desktopConfig.offlineGraceDays,
		saasUrl: saasUrl ?? null,
	};
}

/**
 * Config merged over `src-tauri/tauri.conf.json` (`tauri --config`): every
 * name comes from `config.app` via `@fuutu/desktop/identity`, the version
 * from the root package.json. Release builds never get the devtools
 * capability or the global Tauri object, and always get a strict CSP.
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
				// The dev server needs HMR websockets + eval; release is locked down.
				csp: dev ? null : releaseCsp(input.saasUrl),
				capabilities: dev ? ["default", DEVTOOLS_CAPABILITY] : ["default"],
			},
		},
	};
}
