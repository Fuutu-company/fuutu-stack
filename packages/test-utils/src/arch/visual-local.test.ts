import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
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

describe("visual-prune: static orphan rules", () => {
	const ctx = {
		locales: ["en", "de"],
		specSource: [
			'expectVisual(page, "core--dashboard.png");',
			'{ path: "", name: "marketing--landing" },',
			'{ name: "marketing--pricing" },',
		].join("\n"),
	};

	it("flags a disabled locale, a page no spec names and a viewport on the wrong project class", () => {
		expect(
			lib.orphanReason("marketing--landing-fr-desktop-chromium-linux.png", ctx),
		).toBe("disabled locale");
		expect(lib.orphanReason("core--crm-chromium-linux.png", ctx)).toBe(
			"no visual spec names this page",
		);
		expect(
			lib.orphanReason("marketing--pricing-en-mobile-chromium-linux.png", ctx),
		).toBe("viewport shot on the wrong project class");
		expect(
			lib.orphanReason(
				"marketing--pricing-en-desktop-mobile-safari-linux.png",
				ctx,
			),
		).toBe("viewport shot on the wrong project class");
	});

	it("keeps every baseline a spec still names, on every browser", () => {
		for (const file of [
			"core--dashboard-chromium-linux.png",
			"core--dashboard-mobile-safari-linux.png",
			"core--dashboard-firefox-linux.png",
			"marketing--landing-de-desktop-webkit-linux.png",
			"marketing--pricing-en-mobile-mobile-chrome-linux.png",
		]) {
			expect(lib.orphanReason(file, ctx), file).toBeNull();
		}
	});

	it("never prunes a name it cannot classify — the guard test reports those", () => {
		expect(lib.orphanReason("core--dashboard-msedge-linux.png", ctx)).toBe(
			"unknown project",
		);
		expect(
			lib.prunableOrphans(
				[
					"core--dashboard-msedge-linux.png",
					"core--crm-chromium-darwin.png",
					"core--crm-chromium-linux.png",
				],
				ctx,
			),
		).toEqual(["core--crm-chromium-linux.png"]);
	});
});

describe("visual-prune: CLI after a partial update run", () => {
	const SAAS_SPEC = [
		'expectVisual(page, "core--dashboard.png");',
		'expectVisual(page, "core--settings.png");',
	].join("\n");
	const MARKETING_SPEC = [
		'{ path: "", name: "marketing--landing" },',
		'expectVisual(menu, "component--locale-switcher.png");',
	].join("\n");
	const I18N_CONFIG = `export const i18nConfig = {
	locales: { en: { label: "English" }, de: { label: "Deutsch" } },
	defaultLocale: "en",
} as const;
`;
	const SAAS = [
		"core--dashboard-chromium-linux.png",
		"core--dashboard-mobile-safari-linux.png",
		"core--settings-chromium-linux.png",
		"core--settings-mobile-safari-linux.png",
		"core--settings-firefox-linux.png",
	];
	const MARKETING = [
		"marketing--landing-en-desktop-chromium-linux.png",
		"marketing--landing-de-desktop-chromium-linux.png",
		"marketing--landing-en-mobile-mobile-safari-linux.png",
		"component--locale-switcher-chromium-linux.png",
	];

	/**
	 * A throwaway repo with copies of the real scripts — they resolve the
	 * repo root from their own location, so nothing here touches the real
	 * baselines. Every baseline predates the run (`mtime` an hour ago): an
	 * update run leaves byte-identical renders untouched.
	 */
	function fixtureRepo() {
		const root = mkdtempSync(join(tmpdir(), "fuutu-visual-prune-"));
		const put = (rel: string, body: string | Buffer) => {
			mkdirSync(dirname(join(root, rel)), { recursive: true });
			writeFileSync(join(root, rel), body);
		};
		for (const rel of [
			"tooling/scripts/visual-prune.mjs",
			"tooling/scripts/visual-local-lib.mjs",
			"packages/i18n/scripts/locales.mjs",
		]) {
			put(rel, read(rel));
		}
		put("packages/i18n/config.ts", I18N_CONFIG);
		put("apps/saas/tests/visual.spec.ts", SAAS_SPEC);
		put("apps/marketing/tests/visual.spec.ts", MARKETING_SPEC);
		const hourAgo = new Date(Date.now() - 3_600_000);
		const baseline = (app: string, file: string) => {
			const rel = `.fuutu/visual-baselines/${app}/${file}`;
			put(rel, "png");
			utimesSync(join(root, rel), hourAgo, hourAgo);
		};
		for (const file of SAAS) baseline("saas", file);
		for (const file of MARKETING) baseline("marketing", file);
		const list = (app: string) =>
			readdirSync(join(root, ".fuutu", "visual-baselines", app)).sort();
		const prune = (app: string) =>
			spawnSync(
				process.execPath,
				[join(root, "tooling/scripts/visual-prune.mjs"), "--app", app],
				{ encoding: "utf8" },
			);
		return { root, put, list, prune, baseline };
	}

	it("a chromium-only saas run deletes no mobile-safari or marketing baseline", () => {
		const repo = fixtureRepo();
		try {
			// The run rewrote only the chromium shots that changed.
			repo.put(
				".fuutu/visual-baselines/saas/core--dashboard-chromium-linux.png",
				"new",
			);
			const result = repo.prune("saas");
			expect(result.status, result.stderr).toBe(0);
			expect(repo.list("saas")).toEqual([...SAAS].sort());
			expect(repo.list("marketing")).toEqual([...MARKETING].sort());
		} finally {
			rmSync(repo.root, { recursive: true, force: true });
		}
	});

	it("a run that rewrote nothing deletes nothing, in neither app", () => {
		const repo = fixtureRepo();
		try {
			for (const app of ["saas", "marketing"]) {
				const result = repo.prune(app);
				expect(result.status, result.stderr).toBe(0);
			}
			expect(repo.list("saas")).toEqual([...SAAS].sort());
			expect(repo.list("marketing")).toEqual([...MARKETING].sort());
		} finally {
			rmSync(repo.root, { recursive: true, force: true });
		}
	});

	it("still deletes the real orphans of the app that ran — and only of that app", () => {
		const repo = fixtureRepo();
		const saasOrphans = [
			"core--crm-chromium-linux.png", // page no spec names
		];
		const marketingOrphans = [
			"marketing--landing-fr-desktop-chromium-linux.png", // disabled locale
			"marketing--landing-en-mobile-chromium-linux.png", // wrong project class
		];
		try {
			for (const f of saasOrphans) repo.baseline("saas", f);
			for (const f of marketingOrphans) repo.baseline("marketing", f);
			const result = repo.prune("marketing");
			expect(result.status, result.stderr).toBe(0);
			expect(repo.list("marketing")).toEqual([...MARKETING].sort());
			expect(repo.list("saas")).toEqual([...SAAS, ...saasOrphans].sort());
		} finally {
			rmSync(repo.root, { recursive: true, force: true });
		}
	});

	it("deletes nothing when it cannot read the app's specs or locales", () => {
		const repo = fixtureRepo();
		try {
			rmSync(join(repo.root, "apps/saas/tests"), { recursive: true });
			const noSpecs = repo.prune("saas");
			expect(noSpecs.status).not.toBe(0);
			expect(repo.list("saas")).toEqual([...SAAS].sort());

			repo.put("packages/i18n/config.ts", "export const i18nConfig = {};\n");
			const noLocales = repo.prune("marketing");
			expect(noLocales.status).not.toBe(0);
			expect(repo.list("marketing")).toEqual([...MARKETING].sort());
		} finally {
			rmSync(repo.root, { recursive: true, force: true });
		}
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

	it("selects visual specs by title, so app-owned visual specs run too (CI parity)", () => {
		// Any spec whose titles carry "visual regression" is a visual spec —
		// the exact complement of CI's non-visual `--grep-invert` run.
		const runners = {
			container: read("tooling", "scripts", "visual-local-container.sh"),
			native: read("tooling", "scripts", "visual-local.mjs"),
			ci: read(".github", "workflows", "ci.yml"),
		};
		for (const [name, src] of Object.entries(runners)) {
			expect(src, name).not.toContain("tests/visual.spec.ts");
		}
		expect(runners.container).toMatch(
			/playwright test --grep "visual regression"/,
		);
		expect(runners.native).toMatch(/"--grep",\s*"visual regression",/);
		const ciVisual = runners.ci.match(
			/playwright test --grep "visual regression"/g,
		);
		expect(ciVisual?.length).toBe(4);
		expect(runners.ci).toContain('--grep-invert "visual regression"');
	});

	it("updates snapshots of every visual spec by title, in both apps", () => {
		const packageJson = read("package.json");
		expect(packageJson).not.toContain("visual.spec.ts");
		const update: string =
			JSON.parse(packageJson).scripts["test:visual:update"];
		for (const app of ["@fuutu/saas", "@fuutu/marketing"]) {
			expect(update).toContain(
				`pnpm -F ${app} exec playwright test --grep "visual regression" --update-snapshots`,
			);
		}
	});

	it("every update run rewrites all snapshots, not only those past the tolerance", () => {
		const sources = {
			container: read("tooling", "scripts", "visual-local-container.sh"),
			native: read("tooling", "scripts", "visual-local.mjs"),
			ci: read(".github", "workflows", "ci.yml"),
			pkg: read("package.json"),
		};
		for (const [name, src] of Object.entries(sources)) {
			expect(src, name).toContain("--update-snapshots=all");
			// A bare flag means "changed": drifts under maxDiffPixelRatio stay stale.
			expect(src, name).not.toMatch(/--update-snapshots(?!=)/);
		}
	});

	it("CI prunes orphaned baselines after every complete update run", () => {
		const ci = read(".github", "workflows", "ci.yml");
		expect(ci.match(/node tooling\/scripts\/visual-prune\.mjs/g)?.length).toBe(
			3,
		);
	});

	it("CI and the local runner prune by the static rules only, never by what a run rewrote", () => {
		const ci = read(".github", "workflows", "ci.yml");
		const calls = ci.match(/node tooling\/scripts\/visual-prune\.mjs[^\n]*/g);
		expect(
			calls?.map((call) => call.replace(/\$\{\{ matrix\.app \}\}/, "<app>")),
		).toEqual(
			Array(3).fill('node tooling/scripts/visual-prune.mjs --app "<app>"'),
		);
		expect(ci).not.toMatch(/started="\$\(node/);

		// One implementation: the local --update path runs the same script.
		const runner = read("tooling", "scripts", "visual-local.mjs");
		expect(runner).toMatch(/"visual-prune\.mjs"\),\s*"--app",\s*app/);
		expect(runner).not.toMatch(/\b(orphanedBaselines|staleBaselines)\b/);
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
			"NEXT_PUBLIC_MARKETING_URL",
			"PAYMENTS_PRO_PRICE_ID",
			"FUUTU_TELEMETRY_DISABLED",
			// Required by the production build / server, like in CI.
			"TRUST_PROXY_HEADERS",
		]);
		// The only interpolated host value is the throwaway container DB.
		expect(body?.match(/\$\{?\w+/g)).toEqual(["${DATABASE_URL"]);
	});

	it("renders with the CI e2e job's env (same plan, same marketing URL)", () => {
		const ci = read(".github", "workflows", "ci.yml");
		const job = ci.slice(
			ci.indexOf("\n  e2e:"),
			ci.indexOf("\n    steps:", ci.indexOf("\n  e2e:")),
		);
		const ciEnv = [...job.matchAll(/^ {6}([A-Z_]+): (?!\$\{\{)(.+)$/gm)]
			.map(([, key = "", value = ""]) => [key, value.trim()] as const)
			// The runner hands the throwaway container DB in.
			.filter(([key]) => key !== "DATABASE_URL");
		expect(ciEnv.map(([key]) => key)).toEqual(
			expect.arrayContaining([
				"PAYMENTS_PRO_PRICE_ID",
				"NEXT_PUBLIC_MARKETING_URL",
			]),
		);
		for (const [key, value] of ciEnv) {
			expect(script, key).toMatch(
				new RegExp(
					`(^|\\s)${key}=${value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}(\\s|$)`,
					"m",
				),
			);
		}
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
