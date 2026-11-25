#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook: never force-push the default branch
 * (AGENTS.md §11). Blocks `git push` with --force / -f / --force-with-lease /
 * --mirror / a `+refspec` when it targets main or master — explicitly, or
 * implicitly by pushing while main or master is checked out. Force-pushing a
 * feature branch stays allowed. Other tools rely on the §11 text alone.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PROTECTED = new Set(["main", "master"]);
const FORCE_FLAG =
	/^(--force(-with-lease(=.*)?|-if-includes)?|--mirror|-[a-zA-Z]*f[a-zA-Z]*)$/;

const tokens = (segment) =>
	segment
		.trim()
		.split(/\s+/)
		.map((t) => t.replace(/^['"]|['"]$/g, ""))
		.filter(Boolean);

/** The ref a refspec writes to: `src:dst` → dst, `+x` → x, `refs/heads/x` → x. */
const destination = (refspec) =>
	(refspec.replace(/^\+/, "").split(":").at(-1) ?? "").replace(
		/^refs\/heads\//,
		"",
	);

/** Returns a reason string when the command force-pushes a protected branch. */
export function check(command, { currentBranch = () => "" } = {}) {
	for (const segment of String(command).split(/\n|;|&&|\|\|?/)) {
		const words = tokens(segment);
		// the segment's command word (after `VAR=value` prefixes) must be git
		const git = words.findIndex((w) => !/^\w+=/.test(w));
		if (words[git] !== "git") continue;
		// skip global options between `git` and the subcommand (`git -C dir push`)
		let i = git + 1;
		while (i < words.length && words[i]?.startsWith("-")) {
			i += words[i] === "-C" || words[i] === "-c" ? 2 : 1;
		}
		if (words[i] !== "push") continue;
		const args = words.slice(i + 1);
		const flags = args.filter((a) => a.startsWith("-"));
		const positional = args.filter((a) => !a.startsWith("-"));
		const refspecs = positional.slice(1);
		const forced =
			flags.some((f) => FORCE_FLAG.test(f)) ||
			refspecs.some((r) => r.startsWith("+"));
		if (!forced) continue;
		const targets = refspecs.length
			? refspecs.map((r) => (r === "HEAD" ? currentBranch() : destination(r)))
			: [currentBranch()];
		const hit = targets.find((t) => PROTECTED.has(t));
		if (hit) return hit;
	}
	return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	let event = {};
	try {
		event = JSON.parse(readFileSync(0, "utf8") || "{}");
	} catch {
		process.exit(0);
	}
	if (event.tool_name !== "Bash") process.exit(0);
	const branch = check(event.tool_input?.command ?? "", {
		currentBranch: () =>
			spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
				cwd: event.cwd || process.cwd(),
				encoding: "utf8",
			}).stdout?.trim() ?? "",
	});
	if (branch) {
		process.stderr.write(
			`Blocked: force-pushing \`${branch}\` is never allowed (AGENTS.md §11).\nPush a feature branch and open a pull request instead. If the remote moved, fetch and rebase or merge your branch — never overwrite \`${branch}\`.\n`,
		);
		process.exit(2);
	}
	process.exit(0);
}
