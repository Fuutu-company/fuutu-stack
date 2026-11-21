import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	CLI_MANAGED_TAURI_FEATURES,
	revertCliFeatureRewrite,
} from "../lib/kit-manifest";
import {
	buildTauriConfig,
	localizedInfoPlistFiles,
	renderInfoPlistStrings,
} from "../lib/tauri-config";

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

const APP = join(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(join(APP, file), "utf8");

const KIT_TOML = `[package]
name = "desktop-app"

[dependencies]
tauri = { version = "=2.12.5", features = ["tray-icon", "image-png"] }
log = "0.4"
`;

describe("kit Cargo.toml stays unchanged (Tauri CLI feature rewrite)", () => {
	it("knows the features the CLI manages from the config", () => {
		expect([...CLI_MANAGED_TAURI_FEATURES].sort()).toEqual([
			"isolation",
			"macos-private-api",
			"protocol-asset",
		]);
	});

	it("reverts the CLI's macos-private-api rewrite", () => {
		const rewritten = KIT_TOML.replace(
			'features = ["tray-icon"',
			'features = ["macos-private-api", "tray-icon"',
		);
		expect(revertCliFeatureRewrite(KIT_TOML, rewritten)).toBe(KIT_TOML);
		// …and the CLI's removal (spacing included) the other way round.
		const removed = KIT_TOML.replace('["tray-icon"', '[ "tray-icon"');
		expect(revertCliFeatureRewrite(KIT_TOML, removed)).toBe(KIT_TOML);
	});

	it("leaves the file alone when nothing or something else changed", () => {
		expect(revertCliFeatureRewrite(KIT_TOML, KIT_TOML)).toBeNull();
		expect(
			revertCliFeatureRewrite(KIT_TOML, KIT_TOML.replace('"0.4"', '"0.5"')),
		).toBeNull();
		expect(
			revertCliFeatureRewrite(
				KIT_TOML,
				KIT_TOML.replace('"image-png"', '"image-png", "wry"'),
			),
		).toBeNull();
	});

	it("pnpm dev/build:desktop guard the manifest around the CLI", () => {
		const run = read("scripts/run.ts");
		expect(run).toMatch(/guardKitManifest\(\)/);
		expect(run).toMatch(/restoreKitManifest\(\)/);
	});

	it("CI fails when a build left the kit Cargo.toml changed", () => {
		const yaml = read("../../.github/workflows/desktop.yml");
		const build = yaml.indexOf("- name: Build\n");
		const check = yaml.indexOf("- name: Kit Cargo.toml unchanged");
		expect(check).toBeGreaterThan(build);
		expect(yaml.slice(check, check + 400)).toContain(
			"git diff --exit-code -- apps/desktop/src-tauri/Cargo.toml",
		);
	});
});

describe("macOS Info.plist (bundle.macOS)", () => {
	const base = { mode: "build" as const, appVersion: "1.0.0" };

	it("takes infoPlist as a path (Tauri 2.12 MacConfig.info_plist)", () => {
		const config = buildTauriConfig({
			...base,
			appTauriConfig: { bundle: { macOS: { infoPlist: "Info.plist" } } },
		}) as unknown as { bundle: { macOS: { infoPlist: string } } };
		expect(config.bundle.macOS.infoPlist).toBe("Info.plist");
		expect(() =>
			buildTauriConfig({
				...base,
				appTauriConfig: {
					bundle: {
						macOS: { infoPlist: { NSMicrophoneUsageDescription: "x" } },
					},
				},
			}),
		).toThrow(/infoPlist.*path/);
	});

	it("maps per-locale InfoPlist.strings into bundle.macOS.files", () => {
		expect(localizedInfoPlistFiles(["en", "de"], "macos")).toEqual({
			"Resources/en.lproj/InfoPlist.strings":
				"macos/en.lproj/InfoPlist.strings",
			"Resources/de.lproj/InfoPlist.strings":
				"macos/de.lproj/InfoPlist.strings",
		});
		expect(() =>
			buildTauriConfig({
				...base,
				appTauriConfig: { bundle: { macOS: { files: { a: 1 } } } },
			}),
		).toThrow(/files/);
	});

	it("renders InfoPlist.strings entries, escaped", () => {
		expect(
			renderInfoPlistStrings({
				NSMicrophoneUsageDescription: 'Acme nimmt "Notizen" auf',
			}),
		).toBe(
			'"NSMicrophoneUsageDescription" = "Acme nimmt \\"Notizen\\" auf";\n',
		);
	});
});
