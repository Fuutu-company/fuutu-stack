import { desktopIdentity } from "@fuutu/desktop/identity";
import { describe, expect, it } from "vitest";
import {
	buildTauriConfig,
	DEVTOOLS_CAPABILITY,
	desktopRuntimeConfig,
	ed25519Keys,
} from "../lib/tauri-config";

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
		expect(config.app.security.capabilities).toEqual(["default"]);
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
		const none = buildTauriConfig({ mode: "build", appVersion: "1.0.0" });
		expect("updater" in none.plugins).toBe(false);
		expect("bundle" in none).toBe(false);

		const signed = buildTauriConfig({
			mode: "build",
			appVersion: "1.0.0",
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
		const base = { mode: "build" as const, appVersion: "1.0.0" };
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
