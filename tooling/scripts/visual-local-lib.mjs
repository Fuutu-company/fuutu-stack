// Pure helpers for visual-local.mjs — no I/O, unit-tested in
// packages/test-utils/src/arch/visual-local.test.ts.
import path from "node:path";

export const APPS = ["saas", "marketing"];
// Distro suffix of the Playwright image; the CI e2e job uses the same one
// (guarded by the arch test).
const IMAGE_DISTRO = "noble";

/** @returns {{ apps: string[]; update: boolean; native: boolean; open: boolean; platform: string | null }} */
export function parseArgs(argv) {
	const opts = {
		apps: [...APPS],
		update: false,
		native: false,
		open: false,
		platform: null,
	};
	const value = (flag, i, inline) => {
		const v = inline ?? argv[i + 1];
		if (!v || v.startsWith("--")) throw new Error(`${flag} needs a value`);
		return v;
	};
	for (let i = 0; i < argv.length; i++) {
		const [flag, inline] = argv[i].split(/=(.*)/s, 2);
		switch (flag) {
			case "--app": {
				const v = value("--app", i, inline);
				if (inline === undefined) i++;
				if (!APPS.includes(v))
					throw new Error(`--app must be ${APPS.join("|")}`);
				opts.apps = [v];
				break;
			}
			case "--platform":
				opts.platform = value("--platform", i, inline);
				if (inline === undefined) i++;
				break;
			case "--update":
				opts.update = true;
				break;
			case "--native":
				opts.native = true;
				break;
			case "--open":
				opts.open = true;
				break;
			default:
				throw new Error(`Unknown option ${argv[i]}`);
		}
	}
	return opts;
}

/** Exact `@playwright/test` pin from pnpm-workspace.yaml (the catalog). */
export function playwrightVersion(workspaceYaml) {
	const m = /["']?@playwright\/test["']?:\s*(\d+\.\d+\.\d+)\s*$/m.exec(
		workspaceYaml,
	);
	if (!m) {
		throw new Error(
			"Could not read an exact @playwright/test version from the pnpm catalog",
		);
	}
	return m[1];
}

export const playwrightImage = (version) =>
	`mcr.microsoft.com/playwright:v${version}-${IMAGE_DISTRO}`;

/** All local output lives under .fuutu (gitignored, except visual-baselines). */
export function appPaths(root, app, mode) {
	const local = path.join(root, ".fuutu", "visual-local");
	const workDir = path.join(local, mode, app);
	return {
		reportRoot: path.join(root, ".fuutu", "visual-report"),
		reportDir: path.join(root, ".fuutu", "visual-report", app),
		workDir,
		expectedDir: path.join(workDir, "expected"),
		actualDir: path.join(workDir, "actual"),
		committedDir: path.join(root, ".fuutu", "visual-baselines", app),
		nativeBaselineDir: path.join(local, "native-baselines", app),
	};
}

/** Committed baselines are CI renders — Linux only. */
export const isCiBaseline = (file) => file.endsWith("-linux.png");
