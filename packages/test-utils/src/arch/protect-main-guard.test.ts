import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: agents never force-push main or master (AGENTS.md §11). Claude Code
 * enforces it with a PreToolUse hook (`.claude/hooks/protect-main.mjs`);
 * force-pushing a feature branch stays allowed.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const HOOK = join(REPO_ROOT, ".claude", "hooks", "protect-main.mjs");

const { check } = (await import(HOOK)) as {
	check: (
		command: string,
		options?: { currentBranch?: () => string },
	) => string | null;
};

const onBranch = (branch: string) => ({ currentBranch: () => branch });

describe("protect-main hook", () => {
	it("Claude Code runs the hook before every shell command", () => {
		const settings = JSON.parse(
			readFileSync(join(REPO_ROOT, ".claude", "settings.json"), "utf8"),
		);
		const entry = settings.hooks?.PreToolUse?.find(
			(h: { hooks: { command: string }[] }) =>
				h.hooks.some((x) => x.command.includes("protect-main.mjs")),
		);
		expect(entry?.matcher.split("|")).toContain("Bash");
	});

	it.each([
		["git push --force origin main", "feat/x"],
		["git push -f origin main", "feat/x"],
		["git push origin main -f", "feat/x"],
		["git push origin +main", "feat/x"],
		["git push --force-with-lease origin HEAD:refs/heads/main", "feat/x"],
		["git push --force", "main"],
		["git push -uf origin HEAD", "master"],
		["git -C ../repo push --force origin main", "feat/x"],
		["pnpm check && git push --force origin main", "feat/x"],
	])("blocks: %s (on %s)", (command, branch) => {
		expect(check(command, onBranch(branch))).not.toBeNull();
	});

	it.each([
		["git push origin main", "main"],
		["git push --force-with-lease origin feat/x", "main"],
		["git push -f", "feat/x"],
		["git push --follow-tags origin main", "main"],
		["git status && git log --oneline main", "main"],
		["echo 'git push --force origin main' > notes.md", "feat/x"],
	])("allows: %s (on %s)", (command, branch) => {
		expect(check(command, onBranch(branch))).toBeNull();
	});

	it("exits 2 with the fix on stderr when run as a hook", () => {
		const result = spawnSync("node", [HOOK], {
			input: JSON.stringify({
				tool_name: "Bash",
				tool_input: { command: "git push --force origin main" },
				cwd: REPO_ROOT,
			}),
			encoding: "utf8",
		});
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("open a pull request");
	});
});
