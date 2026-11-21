import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Kit-source guard: the desktop app's app-owned hooks SHIP empty / as
 * identity and carry the app-owned header. Kit repository only — buyers
 * fill these files, so no buyer-run test may assert their content
 * (apps/desktop tests check the kit side: wiring, merge, refusals).
 */

const DESKTOP = join(import.meta.dirname, "../../../../../apps/desktop");
const read = (file: string) => readFileSync(join(DESKTOP, file), "utf8");

const HEADER =
	"App-owned — the kit never changes this file's content after release; fill it for your app.";
const fold = (source: string) =>
	source
		.replace(/^\s*(\*|\/\/!|\/\/|#)\s?/gm, "")
		.replace(/\s+/g, " ")
		.trim();

/** File → the line(s) proving its empty / identity default. */
const DEFAULTS: [string, RegExp[]][] = [
	[
		"scripts/lib/app-capabilities.ts",
		[/^export const APP_CAPABILITIES: AppCapability\[\] = \[\];$/m],
	],
	[
		"scripts/lib/app-sidecars.mjs",
		[
			/^export const APP_EXTERNAL_BIN = \[\];$/m,
			/^export function shippedSidecars\(\) \{\s*return \[\];\s*\}$/m,
		],
	],
	[
		"scripts/lib/app-tauri-config.ts",
		[/^export const APP_TAURI_CONFIG: AppTauriConfig = \{\};$/m],
	],
	["src/app-nav.ts", [/^export const appNavItems: AppNavItem\[\] = \[\];$/m]],
	[
		"src/app-home.tsx",
		[/^export const appHome: ComponentType \| null = null;$/m],
	],
	[
		"src/app-about.tsx",
		[/^export const appAboutSection: ComponentType \| null = null;$/m],
	],
	[
		"src/app-shell-slot.tsx",
		[/^export const appShellSlots: AppShellSlots = \{\};$/m],
	],
	[
		"src/app-setup-steps.tsx",
		[/^export const appSetupSteps: AppSetupStep\[\] = \[\];$/m],
	],
	[
		"src-tauri/app-ext/build.rs",
		[/fn main\(\) \{\s*build_forward::reexport_plugin_permissions\(\);\s*\}/],
	],
	[
		"src-tauri/src/app_plugins.rs",
		[
			/pub fn register<R: Runtime>\(\s*builder: Builder<R>,\s*_config: &RuntimeConfig,?\s*\) -> Builder<R> \{\s*builder\s*\}/,
			/pub fn tray_items<R: Runtime>\([^)]*\) -> Vec<TrayItem> \{\s*Vec::new\(\)\s*\}/,
			/pub fn on_tray_menu<R: Runtime>\([^)]*\) \{\}/,
		],
	],
	["src-tauri/app_build.rs", [/pub fn run\(\) \{\s*\}/]],
	["src-tauri/app-ext/src/lib.rs", [/^\s*$|^\/\//m]],
	["src-tauri/app-ext/Cargo.toml", [/^\[dependencies\]\s*$/m]],
	["src-tauri/deny.app.toml", [/^# /m]],
];

describe("desktop app-owned hooks ship empty", () => {
	for (const [file, patterns] of DEFAULTS) {
		it(`${file}: app-owned header + empty default`, () => {
			const source = read(file);
			expect(fold(source)).toContain(HEADER);
			for (const pattern of patterns) expect(source).toMatch(pattern);
		});
	}

	it("app-sidecars.mjs ships no build() (the CI step then does nothing)", () => {
		expect(read("scripts/lib/app-sidecars.mjs")).not.toMatch(
			/^export (async )?function build\b/m,
		);
	});

	it("app-ext declares no dependencies and no code", () => {
		const manifest = read("src-tauri/app-ext/Cargo.toml");
		const deps = manifest.slice(manifest.indexOf("[dependencies]") + 14);
		expect(deps.replace(/#.*$/gm, "").trim()).toBe("");
		const lib = read("src-tauri/app-ext/src/lib.rs");
		expect(lib.replace(/\/\/.*$/gm, "").trim()).toBe("");
	});

	it("deny.app.toml adds no exception", () => {
		const extra = read("src-tauri/deny.app.toml");
		expect(extra.replace(/#.*$/gm, "").trim()).toBe("");
	});
});
