import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard (LICENSE.md §8): a desktop RELEASE build never ships with the kit's
 * name in its identity — product name, bundle id, scheme, OAuth client id,
 * keychain service or user agent. Dev builds only warn (the kit itself is
 * named "Fuutu Stack").
 *
 * - `buildTauriConfig` (the generated Tauri config) throws for a release;
 * - `pnpm build:desktop` (scripts/run.ts) refuses before building.
 *
 * Skips when apps/desktop was removed (the module is deletable).
 */

const ROOT = join(import.meta.dirname, "../../../../");
const TAURI_CONFIG = join(ROOT, "apps/desktop/scripts/lib/tauri-config.ts");
const hasDesktop = existsSync(TAURI_CONFIG);

describe.skipIf(!hasDesktop)(
	"desktop identity carries no kit name in releases",
	() => {
		it("buildTauriConfig refuses a release with the kit name, allows dev", async () => {
			const { buildTauriConfig } = await import(TAURI_CONFIG);
			const { deriveDesktopIdentity } = await import(
				join(ROOT, "packages/desktop/src/identity.ts")
			);
			const none = { bundleId: undefined, scheme: undefined };
			const kit = deriveDesktopIdentity("Fuutu Stack", none);
			const buyer = deriveDesktopIdentity("Acme Notes", none);
			const base = { appVersion: "1.0.0", devUrl: "http://localhost:3002" };

			expect(() =>
				buildTauriConfig({ ...base, mode: "build", identity: kit }),
			).toThrow(/LICENSE\.md §8/);
			expect(
				buildTauriConfig({ ...base, mode: "build", identity: buyer })
					.productName,
			).toBe("Acme Notes");
			expect(
				buildTauriConfig({ ...base, mode: "dev", identity: kit }).productName,
			).toBe("Fuutu Stack");
		});

		it("every identity field is checked, case-insensitively", async () => {
			const { deriveDesktopIdentity, kitNameViolations } = await import(
				join(ROOT, "packages/desktop/src/identity.ts")
			);
			const kit = deriveDesktopIdentity("FUUTU", {
				bundleId: undefined,
				scheme: undefined,
			});
			expect(
				kitNameViolations(kit).map((v: { field: string }) => v.field),
			).toEqual([
				"productName",
				"bundleId",
				"scheme",
				"oauthClientId",
				"keychainService",
				"userAgent",
			]);
		});

		it("pnpm build:desktop checks the identity before anything else", () => {
			const run = readFileSync(
				join(ROOT, "apps/desktop/scripts/run.ts"),
				"utf8",
			);
			const main = run.slice(run.indexOf("async function main()"));
			// The check runs first in main(), and exits for release builds.
			expect(main.indexOf("checkIdentity(mode)")).toBeGreaterThan(-1);
			expect(main.indexOf("checkIdentity(mode)")).toBeLessThan(
				main.indexOf("readDotEnv"),
			);
			const check = run.slice(run.indexOf("function checkIdentity"));
			expect(check).toMatch(
				/if \(mode === "build"\)[\s\S]*?process\.exit\(1\)/,
			);
		});
	},
);
