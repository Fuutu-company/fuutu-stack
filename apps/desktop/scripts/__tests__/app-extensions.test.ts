import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { APP_CAPABILITIES } from "../lib/app-capabilities";
import { APP_EXTERNAL_BIN, shippedSidecars } from "../lib/app-sidecars.mjs";
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
 * Desktop extension points (app-owned, empty in the kit): Tauri
 * capabilities, bundled sidecar programs, a Rust plugin hook.
 */

const APP_CAP = {
	identifier: "app-files",
	windows: ["main"],
	permissions: ["fs:allow-read-text-file"],
};

describe("APP_CAPABILITIES", () => {
	it("ships empty", () => {
		expect(APP_CAPABILITIES).toEqual([]);
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
	it("ships empty", () => {
		expect(APP_EXTERNAL_BIN).toEqual([]);
		expect(shippedSidecars()).toEqual([]);
	});

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

	it("ships as identity", () => {
		const source = readFileSync(join(tauri, "app_plugins.rs"), "utf8");
		expect(source).toMatch(
			/pub fn register<R: Runtime>\(\s*builder: Builder<R>,\s*_config: &RuntimeConfig,?\s*\) -> Builder<R> \{\s*builder\s*\}/,
		);
	});

	it("lib.rs calls it exactly once", () => {
		const lib = readFileSync(join(tauri, "lib.rs"), "utf8");
		expect(lib).toMatch(/^mod app_plugins;$/m);
		expect(lib.match(/app_plugins::register\(/g)).toHaveLength(1);
		// With the resolved runtime config (saas_url, identity, …).
		expect(lib).toContain("app_plugins::register(builder, &config)");
	});
});

describe("app-owned files", () => {
	const HEADER =
		"App-owned — the kit never changes this file's content after release; fill it for your app.";
	const fold = (source: string) =>
		source
			.replace(/^\s*(\*|\/\/!)\s?/gm, "")
			.replace(/\s+/g, " ")
			.trim();
	for (const file of [
		"scripts/lib/app-capabilities.ts",
		"scripts/lib/app-sidecars.mjs",
		"src-tauri/src/app_plugins.rs",
	]) {
		it(`${file} carries the app-owned header`, () => {
			const source = readFileSync(
				join(import.meta.dirname, "../..", file),
				"utf8",
			);
			expect(fold(source)).toContain(HEADER);
		});
	}
});
