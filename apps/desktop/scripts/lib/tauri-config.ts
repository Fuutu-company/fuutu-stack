import { desktopConfig } from "@fuutu/desktop/config";
import { desktopIdentity } from "@fuutu/desktop/identity";

/** Mode the generated Tauri config is for. */
export type TauriConfigMode = "dev" | "build";

export type TauriConfigInput = DesktopBuildInputs & {
	mode: TauriConfigMode;
	/** Sign updater bundles (`TAURI_SIGNING_PRIVATE_KEY` present). */
	signUpdates?: boolean;
	/** YOUR app version (root package.json, `APP_VERSION`). */
	appVersion: string;
	/** Dev server URL on the port slot (dev only). */
	devUrl?: string;
	/**
	 * Windows Authenticode certificate in the build machine's store
	 * (`WINDOWS_CERTIFICATE_THUMBPRINT`, see RELEASING.md). macOS signing
	 * and notarisation need no config — Tauri reads `APPLE_*` from env.
	 */
	windowsCertificateThumbprint?: string;
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
 * Release CSP: only the app bundle and Tauri IPC — the webview reaches the
 * backend solely through the Rust side (`auth_api_fetch`), never with a
 * token of its own. Tauri adds hashes for the export's inline scripts at
 * build time.
 */
export function releaseCsp(): string {
	return [
		"default-src 'self'",
		"script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		"connect-src 'self' ipc: http://ipc.localhost",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'none'",
		"frame-ancestors 'none'",
	].join("; ");
}

/** Build inputs beyond `desktopConfig` (env, fetched keys). */
export type DesktopBuildInputs = {
	/** saas origin the app talks to (`NEXT_PUBLIC_SAAS_URL`). */
	saasUrl?: string;
	/** Backend Ed25519 keys (JWK `x`) trusted for offline claims. */
	offlineKeys?: string[];
	/** Updater public key (`DESKTOP_UPDATER_PUBLIC_KEY`); none = no updater. */
	updaterPubkey?: string;
	/** Public manifest URL for `updates.source: "static"` (`{channel}`). */
	staticUpdateUrl?: string;
};

/**
 * Desktop behaviour the Rust side needs at startup — embedded at compile
 * time via `FUUTU_DESKTOP_CONFIG` (src-tauri/src/config.rs).
 */
export function desktopRuntimeConfig(inputs: DesktopBuildInputs = {}) {
	const updates = desktopConfig.updates;
	return {
		offlineKeys: inputs.offlineKeys ?? [],
		shell: desktopConfig.shell,
		identity: {
			productName: desktopIdentity.productName,
			scheme: desktopIdentity.scheme,
			oauthClientId: desktopIdentity.oauthClientId,
			keychainService: desktopIdentity.keychainService,
		},
		auth: desktopConfig.auth,
		offlineGraceDays: desktopConfig.offlineGraceDays,
		saasUrl: inputs.saasUrl ?? null,
		updates: {
			source: updates.source,
			staticUrl: inputs.staticUpdateUrl ?? null,
			channels: [...updates.channels],
			defaultChannel: updates.defaultChannel,
			pubkey: inputs.updaterPubkey ?? null,
			checkIntervalHours: updates.checkIntervalHours,
		},
	};
}

/**
 * `plugins.updater` (the plugin needs its config to start). The endpoint
 * here is the default channel's; the app sets the real one per check.
 */
export function updaterPluginConfig(inputs: DesktopBuildInputs, dev: boolean) {
	if (!inputs.updaterPubkey) return null;
	const updates = desktopConfig.updates;
	const endpoint =
		updates.source === "static"
			? inputs.staticUpdateUrl?.replace("{channel}", updates.defaultChannel)
			: inputs.saasUrl
				? `${new URL(inputs.saasUrl).origin}/api/desktop/updates/{{target}}/{{arch}}/{{current_version}}?channel=${updates.defaultChannel}`
				: undefined;
	return {
		pubkey: inputs.updaterPubkey,
		endpoints: endpoint ? [endpoint] : [],
		// Only a dev build against the local http backend.
		...(dev &&
			endpoint?.startsWith("http://") && {
				dangerousInsecureTransportProtocol: true,
			}),
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
	const updater = updaterPluginConfig(input, dev);
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
				csp: dev ? null : releaseCsp(),
				capabilities: dev ? ["default", DEVTOOLS_CAPABILITY] : ["default"],
			},
		},
		...(!dev && bundleConfig(input)),
		plugins: {
			// `<scheme>://auth/callback` (sign-in fallback) and
			// `<scheme>://auth/return` (back from the browser).
			"deep-link": { desktop: { schemes: [id.scheme] } },
			...(updater && { updater }),
		},
	};
}

type BundleConfig = {
	createUpdaterArtifacts?: boolean;
	windows?: {
		certificateThumbprint: string;
		digestAlgorithm: string;
		timestampUrl: string;
	};
};

function bundleConfig(input: TauriConfigInput): { bundle?: BundleConfig } {
	const bundle: BundleConfig = {
		...(input.signUpdates && { createUpdaterArtifacts: true }),
		...(input.windowsCertificateThumbprint && {
			windows: {
				certificateThumbprint: input.windowsCertificateThumbprint,
				digestAlgorithm: "sha256",
				timestampUrl: "http://timestamp.digicert.com",
			},
		}),
	};
	return Object.keys(bundle).length > 0 ? { bundle } : {};
}

/** Ed25519 public keys (`x`) of a JWKS document. */
export function ed25519Keys(jwks: unknown): string[] {
	const keys = (jwks as { keys?: unknown[] } | null)?.keys ?? [];
	return keys.flatMap((key) => {
		const k = key as { kty?: string; crv?: string; x?: string };
		return k.kty === "OKP" && k.crv === "Ed25519" && k.x ? [k.x] : [];
	});
}
