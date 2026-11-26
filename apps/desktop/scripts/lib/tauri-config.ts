import { type DesktopAuthMode, desktopConfig } from "@fuutu/desktop/config";
import {
	type DesktopIdentity,
	describeKitNameViolations,
	desktopIdentity,
	kitNameViolations,
} from "@fuutu/desktop/identity";
import { APP_CAPABILITIES, type AppCapability } from "./app-capabilities";
import { APP_TAURI_CONFIG, type AppTauriConfig } from "./app-tauri-config";

export {
	localizedInfoPlistFiles,
	renderInfoPlistStrings,
} from "./macos-info-plist";

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
	/** Identity to build (default: `desktopIdentity` from `config.app`). */
	identity?: DesktopIdentity;
	/** Your capabilities (default: `APP_CAPABILITIES`, app-capabilities.ts). */
	appCapabilities?: readonly AppCapability[];
	/**
	 * Bundled sidecar programs → `bundle.externalBin`, release builds only
	 * (`APP_EXTERNAL_BIN`, app-sidecars.mjs — run.ts passes it).
	 */
	externalBin?: readonly string[];
	/** Your Tauri config keys (default: `APP_TAURI_CONFIG`, app-tauri-config.ts). */
	appTauriConfig?: AppTauriConfig;
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
	/** Offline grace embedded in the app (default `desktopConfig.offlineGraceDays`; `offlineKeyCheck`). */
	offlineGraceDays?: number;
	/** Updater public key (`DESKTOP_UPDATER_PUBLIC_KEY`); none = no updater. */
	updaterPubkey?: string;
	/** Public manifest URL for `updates.source: "static"` (`{channel}`). */
	staticUpdateUrl?: string;
	/** Linux build without an AppImage: updates come through the package. */
	updatesViaPackage?: boolean;
	/**
	 * Port slot of this checkout (dev only): the dev identifier becomes
	 * `<bundleId>.dev.s<slot>`, so single-instance and the app data folder
	 * are per worktree and never the installed app's.
	 */
	devSlot?: number;
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
		offlineGraceDays: inputs.offlineGraceDays ?? desktopConfig.offlineGraceDays,
		saasUrl: inputs.saasUrl ?? null,
		updates: {
			source: updates.source,
			staticUrl: inputs.staticUpdateUrl ?? null,
			channels: [...updates.channels],
			defaultChannel: updates.defaultChannel,
			pubkey: (!inputs.updatesViaPackage && inputs.updaterPubkey) || null,
			checkIntervalHours: updates.checkIntervalHours,
			viaPackage: inputs.updatesViaPackage ?? false,
		},
	};
}

/**
 * `plugins.updater` (the plugin needs its config to start). The endpoint
 * here is the default channel's; the app sets the real one per check.
 */
export function updaterPluginConfig(inputs: DesktopBuildInputs, dev: boolean) {
	if (!inputs.updaterPubkey || inputs.updatesViaPackage) return null;
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
	const id = input.identity ?? desktopIdentity;
	const dev = input.mode === "dev";
	// LICENSE.md §8: a shipped app never carries the kit's name. Dev builds
	// run with it (the kit is "Fuutu Stack"); `run.ts` warns there.
	const violations = kitNameViolations(id, input.appVersion);
	if (!dev && violations.length > 0) {
		throw new Error(
			`Release build refused (LICENSE.md §8): the app identity still carries the kit name.\n${describeKitNameViolations(violations)}\nSet config.app.name (packages/config/index.ts) or desktopConfig.identity — see apps/desktop/RELEASING.md.`,
		);
	}
	const updater = updaterPluginConfig(input, dev);
	const appCapabilities = input.appCapabilities ?? APP_CAPABILITIES;
	assertNoDevtools(appCapabilities);
	const config = {
		productName: id.productName,
		version: input.appVersion,
		identifier: dev
			? `${id.bundleId}.dev${input.devSlot === undefined ? "" : `.s${input.devSlot}`}`
			: id.bundleId,
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
					// ≥ the sidebar breakpoint (768 px): the sidebar stays docked.
					minWidth: 800,
					minHeight: 480,
				},
			],
			security: {
				// The dev server needs HMR websockets + eval; release is locked down.
				csp: dev ? null : releaseCsp(),
				capabilities: [
					"default",
					...saasLinksCapability(input.saasUrl),
					...appCapabilities,
					...(dev ? [DEVTOOLS_CAPABILITY] : []),
				],
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
	const merged = mergeAppTauriConfig(
		config,
		input.appTauriConfig ?? APP_TAURI_CONFIG,
	);
	if (!merged.app.windows.some((w: { label?: string }) => w.label === "main")) {
		throw new Error(
			'app-tauri-config.ts: app.windows must keep the "main" window (the shell, sign-in and tray use it).',
		);
	}
	return merged;
}

/**
 * The app opens only its own SaaS app in the browser (account, billing,
 * devices — everything beyond the desktop app lives there). The opener
 * plugin refuses URLs outside this scope.
 */
function saasLinksCapability(saasUrl: string | undefined) {
	if (!saasUrl) return [];
	const origin = new URL(saasUrl).origin;
	return [
		{
			identifier: "saas-links",
			description:
				"Open the SaaS app (account, billing, devices) in the browser.",
			windows: ["main", "about"],
			permissions: [
				{
					identifier: "opener:allow-open-url",
					allow: [{ url: `${origin}/*` }],
				},
			],
		},
	];
}

/** The devtools capability / automation bridge is the kit's, debug-only. */
function assertNoDevtools(capabilities: readonly AppCapability[]) {
	for (const capability of capabilities) {
		const id =
			typeof capability === "string" ? capability : capability.identifier;
		const bridge =
			typeof capability !== "string" &&
			JSON.stringify(capability.permissions).includes("mcp-bridge");
		if (id === DEVTOOLS_CAPABILITY.identifier || bridge) {
			throw new Error(
				"app-capabilities.ts: the devtools capability and the automation bridge (mcp-bridge) are debug-only kit capabilities — remove them.",
			);
		}
	}
}

/**
 * Config paths `app-tauri-config.ts` may not set: identity, build
 * commands (they run with the signing secrets), security, updater, deep
 * link, sidecars (app-sidecars.mjs) and signing.
 */
export const PROTECTED_TAURI_KEYS = [
	"identifier",
	"productName",
	"version",
	"mainBinaryName",
	"build",
	"app.security",
	"app.withGlobalTauri",
	"plugins.updater",
	"plugins.deep-link",
	"bundle.createUpdaterArtifacts",
	"bundle.externalBin",
	"bundle.windows.certificateThumbprint",
	"bundle.windows.signCommand",
	"bundle.macOS.signingIdentity",
] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

function leafPaths(value: unknown, prefix = ""): string[] {
	if (!isObject(value) || Object.keys(value).length === 0) return [prefix];
	return Object.entries(value).flatMap(([key, child]) =>
		leafPaths(child, prefix ? `${prefix}.${key}` : key),
	);
}

/**
 * Deep-merges the app's Tauri keys into the generated config: objects key
 * by key, arrays and values replace. Throws on a protected key.
 */
export function mergeAppTauriConfig<T extends object>(
	config: T,
	override: AppTauriConfig,
): T {
	const refused = leafPaths(override)
		.filter(Boolean)
		.filter((path) =>
			PROTECTED_TAURI_KEYS.some(
				(key) => path === key || path.startsWith(`${key}.`),
			),
		);
	if (refused.length > 0) {
		throw new Error(
			`app-tauri-config.ts: ${refused.join(", ")} not overridable (security / identity — see the file's header).`,
		);
	}
	assertMacOSBundle(override);
	return merge(config, override) as T;
}

/**
 * Tauri 2.12 `bundle.macOS`: `infoPlist` is the PATH of a plist merged
 * into the app's Info.plist (relative to src-tauri/), `files` maps bundle
 * paths (relative to `Contents/`) to source files.
 */
function assertMacOSBundle(override: AppTauriConfig) {
	const bundle = override.bundle;
	const macOS = isObject(bundle) ? bundle.macOS : undefined;
	if (!isObject(macOS)) return;
	if ("infoPlist" in macOS && typeof macOS.infoPlist !== "string") {
		throw new Error(
			'app-tauri-config.ts: bundle.macOS.infoPlist is the path of a plist file (e.g. "Info.plist" in src-tauri/), not its entries.',
		);
	}
	if (
		"files" in macOS &&
		!(
			isObject(macOS.files) &&
			Object.values(macOS.files).every((v) => typeof v === "string")
		)
	) {
		throw new Error(
			'app-tauri-config.ts: bundle.macOS.files maps bundle paths to source paths, e.g. { "Resources/de.lproj/InfoPlist.strings": "macos/de.lproj/InfoPlist.strings" }.',
		);
	}
}

function merge(base: unknown, override: unknown): unknown {
	if (!isObject(base) || !isObject(override)) return override;
	const out: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(override)) {
		out[key] = key in base ? merge(base[key], value) : value;
	}
	return out;
}

type BundleConfig = {
	createUpdaterArtifacts?: boolean;
	externalBin?: string[];
	windows?: {
		certificateThumbprint: string;
		digestAlgorithm: string;
		timestampUrl: string;
	};
};

function bundleConfig(input: TauriConfigInput): { bundle?: BundleConfig } {
	const bundle: BundleConfig = {
		...(input.signUpdates && { createUpdaterArtifacts: true }),
		...(input.externalBin?.length && { externalBin: [...input.externalBin] }),
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

/** Opt-out env of the offline key requirement (RELEASING.md). */
export const NO_OFFLINE_KEYS_ENV = "DESKTOP_ALLOW_NO_OFFLINE_KEYS";

/**
 * Release builds pin offline claims to the backend's Ed25519 keys
 * (`/api/auth/jwks`, embedded at build time — src-tauri/src/auth/offline.rs
 * trusts no other key). Without a key a build with sign-in and offline
 * grace fails, unless `DESKTOP_ALLOW_NO_OFFLINE_KEYS=1` explicitly ships
 * it without offline grace (`graceDays: 0`).
 */
export function offlineKeyCheck(input: {
	auth: DesktopAuthMode;
	graceDays: number;
	keys: readonly string[];
	optOut: boolean;
}): { error: string | null; graceDays: number } {
	if (input.auth === "off" || input.graceDays === 0 || input.keys.length > 0) {
		return { error: null, graceDays: input.graceDays };
	}
	if (input.optOut) return { error: null, graceDays: 0 };
	return {
		error: `No Ed25519 key from NEXT_PUBLIC_SAAS_URL/api/auth/jwks — a release build pins offline claims to it. Build against your running production app, or set ${NO_OFFLINE_KEYS_ENV}=1 to ship without offline grace (apps/desktop/RELEASING.md).`,
		graceDays: input.graceDays,
	};
}

/**
 * Signing secrets (updater key, Apple notarisation, Windows certificate).
 * `pnpm build:desktop` passes them only to `tauri build` — never to the
 * telemetry ping, `next build` or the licence scripts (RELEASING.md).
 */
const SIGNING_ENV = /^(TAURI_SIGNING_|APPLE_|WINDOWS_CERTIFICATE)/;

export function splitSigningEnv(env: NodeJS.ProcessEnv): {
	base: NodeJS.ProcessEnv;
	signing: NodeJS.ProcessEnv;
} {
	const base = {} as NodeJS.ProcessEnv;
	const signing = {} as NodeJS.ProcessEnv;
	for (const [key, value] of Object.entries(env)) {
		(SIGNING_ENV.test(key) ? signing : base)[key] = value;
	}
	return { base, signing };
}
