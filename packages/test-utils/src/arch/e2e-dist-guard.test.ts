import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: the E2E build (`next.mjs e2e <app>`) writes to its own `distDir`,
 * so `next build` never overwrites the `.next` of the running dev server.
 * The launcher sets NEXT_DIST_DIR for build and start; every app it can
 * build for E2E reads it, and the output stays out of git, Docker and Biome.
 */
const REPO_ROOT = join(import.meta.dirname, "../../../../");
const read = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), "utf8");

const launcher = read("tooling", "scripts", "next.mjs");
const e2eApps = Object.keys(
	JSON.parse(
		(launcher.match(/const E2E_PORT = (\{[^}]*\})/)?.[1] ?? "{}").replace(
			/(\w+):/g,
			'"$1":',
		),
	),
);

describe("E2E build output guard", () => {
	it("finds the E2E apps in the launcher", () => {
		expect(e2eApps.sort()).toEqual(["marketing", "saas"]);
	});

	it("the launcher's e2e env sets NEXT_DIST_DIR", () => {
		const e2eEnv = launcher.match(/\.\.\.\(e2e && \{([\s\S]*?)\}\)/)?.[1];
		expect(e2eEnv).toContain('NEXT_DIST_DIR: ".next-e2e"');
	});

	it("restores next-env.d.ts after the build (also on failure) and before start", () => {
		const flow = launcher.slice(launcher.indexOf("if (e2e) {"));
		const snapshot = flow.indexOf("next-env.d.ts");
		const build = flow.indexOf('next(["build"');
		const restoreAfterBuild = flow.indexOf("restoreNextEnv()", build);
		const failCheck = flow.indexOf("if (built !== 0)");
		const start = flow.indexOf('next(["start"');
		expect(snapshot).toBeGreaterThan(-1);
		expect(snapshot).toBeLessThan(build);
		expect(restoreAfterBuild).toBeGreaterThan(build);
		// restored before the failure exit, so a failed build restores too
		expect(restoreAfterBuild).toBeLessThan(failCheck);
		expect(flow.indexOf("restoreNextEnv()", failCheck)).toBeGreaterThan(-1);
		expect(flow.indexOf("restoreNextEnv()", failCheck)).toBeLessThan(start);
	});

	it.each(e2eApps)("apps/%s/next.config.ts honours it", (app) => {
		expect(read("apps", app, "next.config.ts")).toMatch(
			/distDir: process\.env\.NEXT_DIST_DIR \?\? "\.next",/,
		);
	});

	it("the E2E output is ignored like .next", () => {
		expect(read(".gitignore")).toMatch(/^\.next-e2e$/m);
		expect(read(".dockerignore")).toMatch(/^\*\*\/\.next-e2e$/m);
		expect(JSON.parse(read("biome.json")).files.includes).toContain(
			"!**/.next-e2e",
		);
	});
});
