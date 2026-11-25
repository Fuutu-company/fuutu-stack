import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Open work at session start (`tooling/scripts/open-work.mjs`, printed by
 * `dev-session.mjs ensure`): plan progress files and linked worktrees, a
 * worktree whose branch is merged flagged for closing — so finished work
 * gets closed (`close-work` skill) instead of piling up.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const MODULE = join(REPO_ROOT, "tooling", "scripts", "open-work.mjs");

const { collectOpenWork, formatOpenWork } = (await import(MODULE)) as {
	collectOpenWork: (root: string) => string;
	formatOpenWork: (input: {
		progress: string[];
		worktrees: { path: string; branch: string; merged: boolean }[];
		base: string;
	}) => string;
};

const sandbox = realpathSync(mkdtempSync(join(tmpdir(), "open-work-")));
afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

const git = (cwd: string, ...args: string[]) => {
	const r = spawnSync("git", args, { cwd, encoding: "utf8" });
	if (r.status !== 0) throw new Error(r.stderr);
	return r.stdout;
};

const AUTHOR = ["-c", "user.name=t", "-c", "user.email=t@t"];
const commit = (cwd: string, message: string) =>
	git(cwd, ...AUTHOR, "commit", "-q", "--allow-empty", "-m", message);

describe("open work", () => {
	it("prints nothing when nothing is open", () => {
		expect(formatOpenWork({ progress: [], worktrees: [], base: "main" })).toBe(
			"",
		);
	});

	it("caps the list", () => {
		const progress = Array.from(
			{ length: 14 },
			(_, i) => `docs/plans/p${i}.progress.md`,
		);
		const out = formatOpenWork({ progress, worktrees: [], base: "main" });
		expect(out.trim().split("\n")).toHaveLength(12);
		expect(out).toContain("… 4 more");
	});

	it("lists progress files and worktrees, merged ones flagged", () => {
		const repo = join(sandbox, "repo");
		const wt = (name: string) => join(sandbox, name);
		mkdirSync(join(repo, "docs/plans"), { recursive: true });
		git(repo, "init", "-q", "-b", "main");
		commit(repo, "init");
		// finished: own commit, merged into main
		git(repo, "worktree", "add", "-q", "-b", "feat/done", wt("wt-done"));
		commit(wt("wt-done"), "done");
		git(repo, ...AUTHOR, "merge", "-q", "--no-ff", "-m", "merge", "feat/done");
		// in progress: own commit, not merged
		git(repo, "worktree", "add", "-q", "-b", "feat/open", wt("wt-open"));
		commit(wt("wt-open"), "wip");
		// fresh: still at main's HEAD — new work, never "merged"
		git(repo, "worktree", "add", "-q", "-b", "feat/fresh", wt("wt-fresh"));
		writeFileSync(
			join(repo, "docs/plans/2026-11-25-x.progress.md"),
			"- [ ] task\n",
		);

		const out = collectOpenWork(repo);
		expect(out).toContain("4 open item(s)");
		expect(out).toMatch(/wt-done \(feat\/done\) — merged into main, close it/);
		expect(out).toMatch(/wt-open \(feat\/open\)\n/);
		expect(out).toMatch(/wt-fresh \(feat\/fresh\)\n/);
		expect(out).toContain("plan docs/plans/2026-11-25-x.progress.md");
	});

	it("never throws — a broken docs/plans prints nothing", () => {
		const repo = join(sandbox, "broken");
		mkdirSync(join(repo, "docs"), { recursive: true });
		writeFileSync(join(repo, "docs/plans"), "not a folder");
		expect(() => collectOpenWork(repo)).not.toThrow();
	});

	it("is printed by the SessionStart entry point", async () => {
		const { readFileSync } = await import("node:fs");
		const source = readFileSync(
			join(REPO_ROOT, "tooling/scripts/dev-session.mjs"),
			"utf8",
		);
		expect(source).toContain("process.stdout.write(collectOpenWork(ROOT))");
	});
});
