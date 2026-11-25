/**
 * Open work of this checkout, printed at session start (`dev-session.mjs
 * ensure`) so the lead sees what is still open and closes finished items
 * (`close-work` skill). Sources are what already lives on disk — no ledger:
 * progress files of running plans (`docs/plans/*.progress.md`) and linked
 * git worktrees, flagged when their branch is merged into this checkout's HEAD
 * (a branch still at HEAD counts as fresh, not merged).
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const MAX_LINES = 10;

const git = (root, args) => {
	const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
	return result.status === 0 ? result.stdout : "";
};

/** Linked worktrees (never the checkout itself) from `git worktree list --porcelain`. */
export function parseWorktrees(porcelain, root) {
	return porcelain
		.split("\n\n")
		.map((block) => ({
			path: /^worktree (.+)$/m.exec(block)?.[1],
			branch: /^branch refs\/heads\/(.+)$/m.exec(block)?.[1] ?? "(detached)",
		}))
		.filter((w) => w.path && w.path !== root);
}

export function formatOpenWork({ progress, worktrees, base }) {
	const lines = [
		...worktrees.map(
			(w) =>
				`  worktree ${w.path} (${w.branch})${w.merged ? ` — merged into ${base}, close it` : ""}`,
		),
		...progress.map((p) => `  plan ${p}`),
	];
	if (!lines.length) return "";
	const shown = lines.slice(0, MAX_LINES);
	if (lines.length > MAX_LINES)
		shown.push(`  … ${lines.length - MAX_LINES} more`);
	return `[open-work] ${lines.length} open item(s) — close finished ones (close-work skill):\n${shown.join("\n")}\n`;
}

export function collectOpenWork(root) {
	try {
		return collect(root);
	} catch {
		return ""; // never break session start
	}
}

function collect(root) {
	const plans = join(root, "docs/plans");
	const progress = existsSync(plans)
		? readdirSync(plans)
				.filter((f) => f.endsWith(".progress.md"))
				.map((f) => relative(root, join(plans, f)))
		: [];
	// merged = its commits are in HEAD and it has commits of its own; a fresh
	// branch still pointing at HEAD is new work, not finished work
	const head = git(root, ["rev-parse", "HEAD"]).trim();
	const merged = new Set(
		git(root, [
			"for-each-ref",
			"--merged=HEAD",
			"--format=%(refname:short) %(objectname)",
			"refs/heads",
		])
			.split("\n")
			.map((line) => line.split(" "))
			.filter(([, sha]) => sha && sha !== head)
			.map(([name]) => name),
	);
	const worktrees = parseWorktrees(
		git(root, ["worktree", "list", "--porcelain"]),
		root,
	).map((w) => ({
		...w,
		path: relative(root, w.path) || w.path,
		merged: merged.has(w.branch),
	}));
	const base = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
	return formatOpenWork({ progress, worktrees, base });
}
