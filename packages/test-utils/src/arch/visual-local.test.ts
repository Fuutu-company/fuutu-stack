import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), "utf8");

const lib = await import("../../../../tooling/scripts/visual-local-lib.mjs");

describe("visual-local: argument parsing", () => {
	it("defaults to both apps in docker mode", () => {
		expect(lib.parseArgs([])).toEqual({
			apps: ["saas", "marketing"],
			update: false,
			native: false,
			open: false,
			platform: null,
		});
	});

	it("parses every flag", () => {
		expect(
			lib.parseArgs([
				"--app",
				"marketing",
				"--update",
				"--native",
				"--open",
				"--platform",
				"linux/amd64",
			]),
		).toEqual({
			apps: ["marketing"],
			update: true,
			native: true,
			open: true,
			platform: "linux/amd64",
		});
	});

	it("accepts --app=<name>", () => {
		expect(lib.parseArgs(["--app=saas"]).apps).toEqual(["saas"]);
	});

	it("rejects unknown apps and flags", () => {
		expect(() => lib.parseArgs(["--app", "docs"])).toThrow(/saas\|marketing/);
		expect(() => lib.parseArgs(["--app"])).toThrow(/--app/);
		expect(() => lib.parseArgs(["--bogus"])).toThrow(/--bogus/);
	});
});

describe("visual-local: playwright image", () => {
	it("reads the exact pin from the pnpm catalog", () => {
		const yaml = [
			"catalog:",
			'  "@playwright/test": 1.99.3',
			'  "@axe-core/playwright": ^4.13.0',
		].join("\n");
		expect(lib.playwrightVersion(yaml)).toBe("1.99.3");
		expect(lib.playwrightImage("1.99.3")).toBe(
			"mcr.microsoft.com/playwright:v1.99.3-noble",
		);
	});

	it("refuses a ranged pin — the image must match exactly", () => {
		expect(() =>
			lib.playwrightVersion('  "@playwright/test": ^1.64.0\n'),
		).toThrow(/exact/);
		expect(() => lib.playwrightVersion("catalog: {}\n")).toThrow(/exact/);
	});

	it("matches the image the CI e2e job runs in (single source: the catalog pin)", () => {
		const version = lib.playwrightVersion(read("pnpm-workspace.yaml"));
		const ci = read(".github", "workflows", "ci.yml");
		expect(ci).toContain(`container: ${lib.playwrightImage(version)}`);
	});
});

describe("visual-local: paths", () => {
	it("keeps all local output under the gitignored .fuutu dir", () => {
		const p = lib.appPaths("/repo", "marketing", "docker");
		expect(p).toEqual({
			reportRoot: "/repo/.fuutu/visual-report",
			reportDir: "/repo/.fuutu/visual-report/marketing",
			workDir: "/repo/.fuutu/visual-local/docker/marketing",
			expectedDir: "/repo/.fuutu/visual-local/docker/marketing/expected",
			actualDir: "/repo/.fuutu/visual-local/docker/marketing/actual",
			committedDir: "/repo/.fuutu/visual-baselines/marketing",
			nativeBaselineDir: "/repo/.fuutu/visual-local/native-baselines/marketing",
		});
	});

	it("keeps native baselines outside the per-run work dir that gets wiped", () => {
		const p = lib.appPaths("/repo", "saas", "native");
		expect(p.nativeBaselineDir.startsWith(`${p.workDir}/`)).toBe(false);
	});

	it("only treats the linux png files as CI baselines", () => {
		expect(
			lib.isCiBaseline("legal--imprint-en-desktop-chromium-linux.png"),
		).toBe(true);
		expect(
			lib.isCiBaseline("component--locale-switcher-chromium-darwin.png"),
		).toBe(false);
		expect(lib.isCiBaseline("notes.txt")).toBe(false);
	});
});

describe("visual-local: wiring", () => {
	it("exposes one root script and ignores the output dirs", () => {
		const scripts = JSON.parse(read("package.json")).scripts;
		expect(scripts["test:visual:local"]).toBe(
			"node tooling/scripts/visual-local.mjs",
		);
		expect(read(".gitignore")).toContain(".fuutu/*");
	});

	it("both playwright configs honour the snapshot dir override", () => {
		for (const app of ["saas", "marketing"]) {
			expect(read("apps", app, "playwright.config.ts")).toContain(
				"process.env.FUUTU_VISUAL_SNAPSHOT_DIR",
			);
		}
	});
});

describe("visual-local: container never receives host secrets", () => {
	const script = read("tooling", "scripts", "visual-local-container.sh");
	const excludes = [...script.matchAll(/--exclude=('([^']*)'|(\S+))/g)].map(
		(m) => m[2] ?? m[3] ?? "",
	);

	/**
	 * GNU tar (the container's) matches an unanchored `--exclude` pattern
	 * without a slash against every path component; `./x` only matches the
	 * archive root.
	 */
	const globToRegExp = (glob: string) =>
		new RegExp(
			`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`,
		);
	const excluded = (path: string) =>
		excludes.some((pattern) =>
			pattern.includes("/")
				? globToRegExp(pattern).test(`./${path}`)
				: path.split("/").some((part) => globToRegExp(pattern).test(part)),
		);

	it("excludes .env files at every depth, unanchored", () => {
		expect(excludes).toContain(".env");
		expect(excludes).toContain(".env.*");
		expect(excludes.filter((p) => p.startsWith("./.env"))).toEqual([]);
		for (const path of [
			".env",
			".env.local",
			"apps/saas/.env",
			"apps/saas/.env.local",
			"apps/marketing/.env.production",
			"packages/db/.env",
		]) {
			expect(excluded(path), path).toBe(true);
		}
	});

	it("excludes agent state (.claude, incl. worktrees with their own .env)", () => {
		expect(excludes).toContain(".claude");
		expect(excluded(".claude/worktrees/x/apps/saas/src/page.tsx")).toBe(true);
	});

	it("still copies the source", () => {
		for (const path of [
			"apps/saas/src/app/layout.tsx",
			"packages/env/src/saas.ts",
			"package.json",
		]) {
			expect(excluded(path), path).toBe(false);
		}
	});

	it("writes only the minimal env vars into the container's .env", () => {
		const body = script.match(/cat > \.env <<ENV\n([\s\S]*?)\nENV/)?.[1];
		const keys = (body ?? "").split("\n").map((line) => line.split("=")[0]);
		expect(keys).toEqual([
			"DATABASE_URL",
			"BETTER_AUTH_URL",
			"EMAIL_PROVIDER",
			"NEXT_PUBLIC_ANALYTICS_PROVIDER",
			"FUUTU_TELEMETRY_DISABLED",
		]);
		// The only interpolated host value is the throwaway container DB.
		expect(body?.match(/\$\{?\w+/g)).toEqual(["${DATABASE_URL"]);
	});

	it("passes no host environment into the container", () => {
		const runner = read("tooling", "scripts", "visual-local.mjs");
		const dockerApp = runner.slice(
			runner.indexOf("async function dockerApp"),
			runner.indexOf("// ── Native mode"),
		);
		expect(dockerApp).not.toContain("process.env");
		expect(dockerApp).not.toContain("--env-file");
	});
});
