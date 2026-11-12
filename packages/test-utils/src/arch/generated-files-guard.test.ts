import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: generated files (Prisma migrations, Prisma client, Zod schemas,
 * lockfile, framework types) are produced by their tool's command — never
 * written by hand. Claude Code enforces it with a PreToolUse hook; CI checks
 * migrations against the schema and regenerates the Zod schemas.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const HOOK = join(REPO_ROOT, ".claude", "hooks", "protect-generated.mjs");

const { check } = (await import(HOOK)) as {
	check: (tool: string, input: Record<string, unknown>) => unknown;
};

const MIGRATION =
	"packages/db/prisma/migrations/20260101000000_x/migration.sql";

describe("generated files guard", () => {
	it("Claude Code runs the hook before every write and shell command", () => {
		const settings = JSON.parse(
			readFileSync(join(REPO_ROOT, ".claude", "settings.json"), "utf8"),
		);
		const entry = settings.hooks?.PreToolUse?.find(
			(h: { hooks: { command: string }[] }) =>
				h.hooks.some((x) => x.command.includes("protect-generated.mjs")),
		);
		expect(entry).toBeDefined();
		for (const tool of ["Write", "Edit", "MultiEdit", "Bash"]) {
			expect(entry.matcher.split("|")).toContain(tool);
		}
	});

	it.each([
		["Write", { file_path: `/r/${MIGRATION}` }],
		["Edit", { file_path: "/r/packages/db/prisma/zod/index.ts" }],
		["Edit", { file_path: "/r/packages/db/prisma/generated/client.ts" }],
		["Edit", { file_path: "/r/pnpm-lock.yaml" }],
		["Write", { file_path: "/r/apps/saas/next-env.d.ts" }],
		["Bash", { command: `echo x > ${MIGRATION}` }],
		["Bash", { command: `cat > ${MIGRATION} <<'EOF'\nCREATE TABLE x();\nEOF` }],
		["Bash", { command: "sed -i '' s/a/b/ packages/db/prisma/zod/index.ts" }],
		["Bash", { command: "rm pnpm-lock.yaml && pnpm i" }],
		["Bash", { command: "cp /tmp/index.ts packages/db/prisma/zod/index.ts" }],
	])("blocks hand edits: %s %o", (tool, input) => {
		expect(check(tool, input)).not.toBeNull();
	});

	it.each([
		["Edit", { file_path: "/r/packages/db/prisma/schema/app.prisma" }],
		["Bash", { command: "pnpm --filter @fuutu/db db:migrate --name add_x" }],
		["Bash", { command: "pnpm db:generate 2>&1 | tail -5" }],
		["Bash", { command: `cat ${MIGRATION}` }],
		["Bash", { command: `cp ${MIGRATION} /tmp/backup.sql` }],
		// a heredoc that only *mentions* the paths as data is not a write to them
		["Bash", { command: `cat > notes.md <<'EOF'\necho x > ${MIGRATION}\nEOF` }],
	])(
		"allows generator commands, reads and unrelated writes: %s %o",
		(tool, input) => {
			expect(check(tool, input)).toBeNull();
		},
	);

	it("every migration folder looks like `prisma migrate dev` created it", () => {
		const dir = join(REPO_ROOT, "packages", "db", "prisma", "migrations");
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (!entry.isDirectory()) {
				expect(entry.name).toBe("migration_lock.toml");
				continue;
			}
			expect(entry.name).toMatch(/^\d{14}_[a-z0-9_]+$/);
			expect(readdirSync(join(dir, entry.name))).toEqual(["migration.sql"]);
		}
	});
});
