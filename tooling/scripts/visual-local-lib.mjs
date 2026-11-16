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

/**
 * Projects whose baselines are committed and refreshed on PRs, develop and
 * locally. A main-branch CI run also writes the other browsers.
 */
export const BASELINE_PROJECTS = ["chromium", "mobile-safari"];

const inProjects = (file, projects) =>
	projects === null ||
	projects.some((project) => file.endsWith(`-${project}-linux.png`));

/**
 * Committed CI baselines (of `projects`) that a complete update run did not
 * write: no spec emits them any more (removed page, disabled locale, a
 * viewport a project no longer shoots).
 */
export function orphanedBaselines(
	committed,
	produced,
	projects = BASELINE_PROJECTS,
) {
	const written = new Set(produced);
	return committed.filter(
		(file) =>
			isCiBaseline(file) && inProjects(file, projects) && !written.has(file),
	);
}

/**
 * Same for CI, where the update run writes straight into the committed dir:
 * a baseline of `projects` last modified before the run started was not
 * rewritten. `projects: null` covers every browser (main branch run).
 *
 * @param {{ file: string; mtimeMs: number }[]} entries
 */
export function staleBaselines(entries, startedAtMs, projects = null) {
	return entries
		.filter(
			({ file, mtimeMs }) =>
				isCiBaseline(file) &&
				inProjects(file, projects) &&
				mtimeMs < startedAtMs,
		)
		.map(({ file }) => file);
}
