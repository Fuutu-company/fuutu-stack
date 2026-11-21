import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { AppCapability } from "../lib/app-capabilities";
import { buildTauriConfig, DEVTOOLS_CAPABILITY } from "../lib/tauri-config";
import { licenseViolations, sidecarPackages } from "../licenses.mjs";

// A buyer's app — the kit's own name refuses release builds (LICENSE.md §8).
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

/**
 * Desktop extension points (app-owned): Tauri capabilities, bundled
 * sidecar programs, a Rust plugin hook. These tests check the kit side
 * only, never the content of the app-owned files (buyers fill them); their
 * shipped defaults are kit-source guards
 * (packages/test-utils/src/arch/kit-source/desktop-app-hooks.test.ts).
 */

const APP_CAP = {
	identifier: "app-files",
	windows: ["main"],
	permissions: ["fs:allow-read-text-file"],
};

describe("APP_CAPABILITIES (app-capabilities.ts)", () => {
	it("never smuggles the devtools capability or the bridge in", () => {
		const cases: AppCapability[][] = [
			[DEVTOOLS_CAPABILITY as unknown as AppCapability],
			["devtools"],
			[{ identifier: "x", permissions: ["mcp-bridge:default"] }],
		];
		for (const appCapabilities of cases) {
			expect(() =>
				buildTauriConfig({
					mode: "build",
					appVersion: "1.0.0",
					appCapabilities,
				}),
			).toThrow(/devtools|automation bridge/);
		}
	});

	it("is appended in release and dev, before the devtools capability", () => {
		const release = buildTauriConfig({
			mode: "build",
			appVersion: "1.0.0",
			appCapabilities: [APP_CAP, "app-extra"],
		});
		expect(release.app.security.capabilities).toEqual([
			"default",
			APP_CAP,
			"app-extra",
		]);
		const dev = buildTauriConfig({
			mode: "dev",
			appVersion: "1.0.0",
			devUrl: "http://localhost:3002",
			appCapabilities: [APP_CAP],
		});
		expect(dev.app.security.capabilities).toEqual([
			"default",
			APP_CAP,
			DEVTOOLS_CAPABILITY,
		]);
	});
});

describe("APP_EXTERNAL_BIN (sidecars)", () => {
	it("reaches bundle.externalBin in release builds only", () => {
		const externalBin = ["binaries/ffmpeg"];
		const release = buildTauriConfig({
			mode: "build",
			appVersion: "1.0.0",
			externalBin,
		});
		expect(release.bundle?.externalBin).toEqual(externalBin);
		const dev = buildTauriConfig({
			mode: "dev",
			appVersion: "1.0.0",
			devUrl: "http://localhost:3002",
			externalBin,
		});
		expect(dev).not.toHaveProperty("bundle");
		// None given → no bundle entry at all.
		expect(
			buildTauriConfig({ mode: "build", appVersion: "1.0.0" }),
		).not.toHaveProperty("bundle");
	});

	it("pnpm build:desktop passes APP_EXTERNAL_BIN", () => {
		const run = readFileSync(join(import.meta.dirname, "../run.ts"), "utf8");
		expect(run).toMatch(/externalBin: APP_EXTERNAL_BIN/);
	});

	it("sidecars join the notices and the licence gate (allowlist)", () => {
		const packages = sidecarPackages([
			{
				name: "ffmpeg",
				version: "7.1",
				license: "LGPL-2.1-or-later",
				text: "…",
			},
			{ name: "helper", version: "1.0.0", license: "MIT", text: "MIT …" },
		]);
		expect(packages.map((p: { ecosystem: string }) => p.ecosystem)).toEqual([
			"sidecar",
			"sidecar",
		]);
		expect(
			licenseViolations(packages).map((v: { name: string }) => v.name),
		).toEqual(["ffmpeg"]);
	});

	it("refuses a sidecar entry without name, version, licence or text", () => {
		expect(() =>
			sidecarPackages([{ name: "x", version: "1", license: "MIT" }]),
		).toThrow(/text/);
		expect(() =>
			sidecarPackages([{ name: "x", version: "1", text: "t" }]),
		).toThrow(/license/);
	});
});

describe("app_plugins::register (Rust plugin hook)", () => {
	const tauri = join(import.meta.dirname, "../../src-tauri/src");

	it("lib.rs calls it exactly once", () => {
		const lib = readFileSync(join(tauri, "lib.rs"), "utf8");
		expect(lib).toMatch(/^mod app_plugins;$/m);
		expect(lib.match(/app_plugins::register\(/g)).toHaveLength(1);
		// With the resolved runtime config (saas_url, identity, …).
		expect(lib).toContain("app_plugins::register(builder, &config)");
	});
});
