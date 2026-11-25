import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The generated-file rules live in tooling/generated-files (single source
 * of truth). The Claude Code hook re-exports them unchanged, and
 * `--json` hands them to editor tooling as `{ source, flags }` patterns
 * that match exactly the same paths.
 */
const REPO_ROOT = join(import.meta.dirname, "../../../../");
const MODULE = join(REPO_ROOT, "tooling/generated-files/index.mjs");

const lib = await import("../../../../tooling/generated-files/index.mjs");
const hook = (await import(
	join(REPO_ROOT, ".claude", "hooks", "protect-generated.mjs")
)) as { GENERATED: unknown };

type JsonRules = {
	schemaVersion: number;
	rules: {
		id: string;
		label: string;
		command: string;
		pattern: { source: string; flags: string };
	}[];
};

const json: JsonRules = JSON.parse(
	execFileSync(process.execPath, [MODULE, "--json"], { encoding: "utf8" }),
);

const SAMPLES = [
	"packages/db/prisma/migrations/20260101000000_x/migration.sql",
	"/r/packages/db/prisma/migrations/migration_lock.toml",
	"/r/packages/db/prisma/zod/index.ts",
	"packages/db/prisma/generated/client.ts",
	"/r/packages/db/prisma/schema/app.prisma",
	"/r/.fuutu/project.json",
	".fuutu/project.json.bak",
	"pnpm-lock.yaml",
	"/r/apps/saas/next-env.d.ts",
	"/r/apps/docs/.source/index.ts",
	"/r/apps/saas/src/app-slots.tsx",
	"/r/README.md",
];

describe("generated-file rules (tooling/generated-files)", () => {
	it("--json is versioned and lists every rule with a stable id", () => {
		expect(json.schemaVersion).toBe(1);
		expect(json.rules.map((r) => r.id)).toEqual([
			"prisma-migrations",
			"prisma-client",
			"port-slot-project",
			"lockfile",
			"framework-types",
		]);
		for (const rule of json.rules) {
			expect(rule.id).toMatch(/^[a-z][a-z0-9-]*$/);
			expect(rule.label).toMatch(/\S/);
			expect(rule.command).toMatch(/\S/);
		}
	});

	it("patterns rebuilt from the JSON match the same paths as matchGeneratedPath", () => {
		const rebuilt = json.rules.map((r) => ({
			id: r.id,
			re: new RegExp(r.pattern.source, r.pattern.flags),
		}));
		for (const path of SAMPLES) {
			const fromJson = rebuilt.find((r) => r.re.test(path))?.id ?? null;
			expect(fromJson, path).toBe(lib.matchGeneratedPath(path)?.id ?? null);
		}
		expect(
			SAMPLES.filter((p) => lib.matchGeneratedPath(p)).length,
		).toBeGreaterThan(5);
		expect(lib.matchGeneratedPath("/r/README.md")).toBeNull();
	});

	it("the Claude Code hook uses the module's rules unchanged", () => {
		expect(hook.GENERATED).toEqual(lib.GENERATED);
		expect(hook.GENERATED).toBe(lib.GENERATED);
	});

	it("the hook still blocks with the same message and exit code", () => {
		const res = spawnSync(
			process.execPath,
			[join(REPO_ROOT, ".claude", "hooks", "protect-generated.mjs")],
			{
				input: JSON.stringify({
					tool_name: "Edit",
					tool_input: { file_path: "/r/pnpm-lock.yaml" },
				}),
				encoding: "utf8",
			},
		);
		expect(res.status).toBe(2);
		expect(res.stderr).toBe(
			"Blocked: the lockfile are generated — never create or change them by hand.\nRun instead: pnpm add / pnpm remove / pnpm install\n",
		);
	});

	it("command heuristics stay out of the JSON", () => {
		for (const rule of json.rules) {
			expect(Object.keys(rule).sort()).toEqual([
				"command",
				"id",
				"label",
				"pattern",
			]);
		}
		expect(lib.matchGeneratedCommand("echo x > pnpm-lock.yaml")?.id).toBe(
			"lockfile",
		);
		expect(lib.matchGeneratedCommand("cat pnpm-lock.yaml")).toBeNull();
	});

	it("the CLI refuses anything but --json", () => {
		expect(() =>
			execFileSync(process.execPath, [MODULE], { stdio: "pipe" }),
		).toThrow();
	});
});
