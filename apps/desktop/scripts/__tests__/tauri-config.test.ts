import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
	deriveDesktopIdentity,
	desktopIdentity,
} from "@fuutu/desktop/identity";
import { describe, expect, it, vi } from "vitest";
import {
	buildTauriConfig,
	DEVTOOLS_CAPABILITY,
	desktopRuntimeConfig,
	ed25519Keys,
	offlineKeyCheck,
	splitSigningEnv,
} from "../lib/tauri-config";

// A buyer's app — the kit's own name ("Fuutu Stack") refuses release builds.
vi.mock("@fuutu/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/config")>();
	return {
		...actual,
		config: {
			...actual.config,
			app: { ...actual.config.app, name: "Acme Notes" },
		},
	};
});

const KIT_IDENTITY = deriveDesktopIdentity("Fuutu Stack", {
	bundleId: undefined,
	scheme: undefined,
});

describe("splitSigningEnv (signing secrets reach only `tauri build`)", () => {
	it("moves every signing secret out of the shared env", () => {
		const { base, signing } = splitSigningEnv({
			NODE_ENV: "production",
			PATH: "/bin",
			NEXT_PUBLIC_SAAS_URL: "https://app.example.com",
			DESKTOP_UPDATER_PUBLIC_KEY: "pub",
			TAURI_SIGNING_PRIVATE_KEY: "secret",
			TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "pw",
			APPLE_CERTIFICATE: "cert",
			APPLE_CERTIFICATE_PASSWORD: "pw",
			APPLE_SIGNING_IDENTITY: "id",
			APPLE_ID: "me@example.com",
			APPLE_PASSWORD: "pw",
			APPLE_TEAM_ID: "team",
			APPLE_API_KEY: "k",
			WINDOWS_CERTIFICATE: "pfx",
			WINDOWS_CERTIFICATE_PASSWORD: "pw",
		});
		expect(base).toEqual({
			NODE_ENV: "production",
			PATH: "/bin",
			NEXT_PUBLIC_SAAS_URL: "https://app.example.com",
			DESKTOP_UPDATER_PUBLIC_KEY: "pub",
		});
		expect(Object.keys(signing).sort()).toEqual([
			"APPLE_API_KEY",
			"APPLE_CERTIFICATE",
			"APPLE_CERTIFICATE_PASSWORD",
			"APPLE_ID",
			"APPLE_PASSWORD",
			"APPLE_SIGNING_IDENTITY",
			"APPLE_TEAM_ID",
			"TAURI_SIGNING_PRIVATE_KEY",
			"TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
			"WINDOWS_CERTIFICATE",
			"WINDOWS_CERTIFICATE_PASSWORD",
		]);
	});

	it("pnpm build:desktop hands them to `tauri build` alone", () => {
		const run = readFileSync(join(import.meta.dirname, "../run.ts"), "utf8");
		const build = run.slice(run.indexOf("async function build("));
		expect(build).toContain("splitSigningEnv(env)");
		expect(build).toContain("env: { ...base, FUUTU_TELEMETRY_SURFACE");
		// Every step but `tauri build` runs on `base`; `{ ...env` never reaches a child.
		expect(build.match(/\], base\]/g)).toHaveLength(4);
		expect(build).toContain("{ ...base, ...signing }");
		expect(build).not.toMatch(/run\([^)]*\{ \.\.\.env/);
	});
});

describe("kit name in a release (LICENSE.md §8)", () => {
	it("refuses a release build whose identity carries the kit name", () => {
		expect(() =>
			buildTauriConfig({
				mode: "build",
				appVersion: "1.0.0",
				identity: KIT_IDENTITY,
			}),
		).toThrow(/LICENSE\.md §8[\s\S]*productName: Fuutu Stack/);
	});

	it("lets dev builds run with it (the kit itself is named Fuutu Stack)", () => {
		const config = buildTauriConfig({
			mode: "dev",
			appVersion: "1.0.0",
			devUrl: "http://localhost:3002",
			identity: KIT_IDENTITY,
		});
		expect(config.productName).toBe("Fuutu Stack");
	});
});

describe("offlineKeyCheck (release builds)", () => {
	const base = { auth: "required" as const, graceDays: 7, optOut: false };

	it("needs at least one backend Ed25519 key", () => {
		expect(offlineKeyCheck({ ...base, keys: ["x"] })).toEqual({
			error: null,
			graceDays: 7,
		});
		expect(offlineKeyCheck({ ...base, keys: [] }).error).toMatch(
			/DESKTOP_ALLOW_NO_OFFLINE_KEYS/,
		);
	});

	it("lets an explicit opt-out build without offline grace", () => {
		expect(offlineKeyCheck({ ...base, keys: [], optOut: true })).toEqual({
			error: null,
			graceDays: 0,
		});
	});

	it("needs no keys without sign-in or without a grace period", () => {
		expect(
			offlineKeyCheck({ ...base, auth: "off", keys: [] }).error,
		).toBeNull();
		expect(
			offlineKeyCheck({ ...base, graceDays: 0, keys: [] }).error,
		).toBeNull();
	});
});

describe("buildTauriConfig", () => {
	it("names the app from config.app (identity), versions it with APP_VERSION", () => {
		const config = buildTauriConfig({ mode: "build", appVersion: "1.4.2" });
		expect(config.productName).toBe(desktopIdentity.productName);
		expect(config.identifier).toBe(desktopIdentity.bundleId);
		expect(config.version).toBe("1.4.2");
		expect(config.app.windows[0]?.title).toBe(desktopIdentity.productName);
	});

	it("never gives a release build the automation bridge or the global Tauri object", () => {
		const config = buildTauriConfig({ mode: "build", appVersion: "1.0.0" });
		expect(config.app.withGlobalTauri).toBe(false);
		// The kit's capability first; the devtools one never (nor through
		// the app's APP_CAPABILITIES — buyers fill that file).
		expect(config.app.security.capabilities[0]).toBe("default");
		expect(config.app.security.capabilities).not.toContainEqual(
			DEVTOOLS_CAPABILITY,
		);
		expect(JSON.stringify(config)).not.toContain("mcp-bridge");
	});

	it("gives dev builds the bridge capability and the slot dev URL", () => {
		const config = buildTauriConfig({
			mode: "dev",
			appVersion: "1.0.0",
			devUrl: "http://localhost:3002",
		});
		expect(config.build).toMatchObject({ devUrl: "http://localhost:3002" });
		expect(config.app.security.capabilities).toContainEqual(
			DEVTOOLS_CAPABILITY,
		);
	});

	it("registers the deep-link scheme from the identity", () => {
		const config = buildTauriConfig({ mode: "build", appVersion: "1.0.0" });
		expect(config.plugins["deep-link"].desktop.schemes).toEqual([
			desktopIdentity.scheme,
		]);
	});

	it("keeps the release CSP free of remote origins", () => {
		const config = buildTauriConfig({
			mode: "build",
			appVersion: "1.0.0",
			saasUrl: "https://app.example.com",
		});
		expect(config.app.security.csp).not.toContain("example.com");
		expect(config.app.security.csp).toContain("connect-src 'self' ipc:");
	});

	it("extracts only Ed25519 keys from a JWKS", () => {
		expect(
			ed25519Keys({
				keys: [
					{ kty: "OKP", crv: "Ed25519", x: "abc" },
					{ kty: "RSA", n: "x" },
					{ kty: "OKP", crv: "X25519", x: "no" },
				],
			}),
		).toEqual(["abc"]);
		expect(ed25519Keys(null)).toEqual([]);
	});

	it("adds the updater only with a public key; signs bundles only in signed release builds", () => {
		// The kit's output only (a buyer's APP_TAURI_CONFIG may add bundle keys).
		const none = buildTauriConfig({
			mode: "build",
			appVersion: "1.0.0",
			appTauriConfig: {},
		});
		expect("updater" in none.plugins).toBe(false);
		expect("bundle" in none).toBe(false);

		const signed = buildTauriConfig({
			mode: "build",
			appVersion: "1.0.0",
			appTauriConfig: {},
			saasUrl: "https://app.example.com",
			updaterPubkey: "pk",
			signUpdates: true,
		});
		expect(signed.plugins.updater).toEqual({
			pubkey: "pk",
			endpoints: [
				"https://app.example.com/api/desktop/updates/{{target}}/{{arch}}/{{current_version}}?channel=stable",
			],
		});
		expect(signed.bundle).toEqual({ createUpdaterArtifacts: true });
	});

	it("signs Windows bundles with a store certificate when given one", () => {
		// The kit's output only (a buyer's APP_TAURI_CONFIG may add bundle keys).
		const base = {
			mode: "build" as const,
			appVersion: "1.0.0",
			appTauriConfig: {},
		};
		expect(buildTauriConfig(base)).not.toHaveProperty("bundle");
		expect(
			buildTauriConfig({ ...base, windowsCertificateThumbprint: "AB12" })
				.bundle,
		).toEqual({
			windows: {
				certificateThumbprint: "AB12",
				digestAlgorithm: "sha256",
				timestampUrl: "http://timestamp.digicert.com",
			},
		});
		expect(
			buildTauriConfig({
				...base,
				mode: "dev",
				windowsCertificateThumbprint: "AB12",
			}),
		).not.toHaveProperty("bundle");
	});

	it("allows plain http update checks only in dev builds", () => {
		const input = {
			appVersion: "1.0.0",
			saasUrl: "http://localhost:3000",
			updaterPubkey: "pk",
		};
		expect(
			buildTauriConfig({ ...input, mode: "dev" }).plugins.updater,
		).toMatchObject({ dangerousInsecureTransportProtocol: true });
		expect(
			buildTauriConfig({ ...input, mode: "build" }).plugins.updater,
		).not.toHaveProperty("dangerousInsecureTransportProtocol");
	});

	it("embeds the updates config for the Rust side", () => {
		expect(
			desktopRuntimeConfig({
				updaterPubkey: "pk",
				staticUpdateUrl: "https://cdn/{channel}.json",
			}).updates,
		).toMatchObject({
			pubkey: "pk",
			staticUrl: "https://cdn/{channel}.json",
			defaultChannel: "stable",
		});
	});
});

describe("links to the SaaS app (opener scope)", () => {
	const caps = (config: ReturnType<typeof buildTauriConfig>) =>
		config.app.security.capabilities as unknown[];

	it("lets the app open exactly the SaaS app's URLs, in dev and release", () => {
		for (const mode of ["dev", "build"] as const) {
			const config = buildTauriConfig({
				mode,
				appVersion: "1.0.0",
				devUrl: "http://localhost:3002",
				saasUrl: "https://app.example.com/",
				appTauriConfig: {},
			});
			expect(caps(config)).toContainEqual({
				identifier: "saas-links",
				description: expect.any(String),
				windows: ["main", "about"],
				permissions: [
					{
						identifier: "opener:allow-open-url",
						allow: [{ url: "https://app.example.com/*" }],
					},
				],
			});
		}
	});

	it("opens nothing without a SaaS URL, and the default capability grants no URL", () => {
		const config = buildTauriConfig({
			mode: "build",
			appVersion: "1.0.0",
			appTauriConfig: {},
		});
		expect(JSON.stringify(caps(config))).not.toContain("saas-links");
		const defaults = JSON.parse(
			readFileSync(
				join(import.meta.dirname, "../../src-tauri/capabilities/default.json"),
				"utf8",
			),
		) as { permissions: unknown[] };
		expect(defaults.permissions).not.toContain("opener:allow-open-url");
		expect(defaults.permissions).not.toContain("opener:allow-default-urls");
	});
});
