import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../../../..");
const includes: string[] = JSON.parse(
	readFileSync(join(root, "biome.json"), "utf8"),
).files.includes;

describe("biome config", () => {
	// Git worktrees live under .claude/worktrees. A `**/` pattern also matches
	// the worktree's own absolute path, so Biome would check nothing when it
	// runs inside a worktree. Anchor the exclusion at the repo root.
	it("excludes Claude worktrees only at the repo root", () => {
		expect(includes).toContain("!.claude/worktrees");
		expect(includes).not.toContain("!**/.claude/worktrees");
	});
});
