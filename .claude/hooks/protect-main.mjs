#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook: never overwrite or delete main or master on a
 * remote (AGENTS.md §11). Blocks `git push` with a force flag (--force, -f,
 * --force-with-lease, --mirror), a `+refspec`, --delete or a `:main` refspec
 * when it targets main or master — explicitly, or implicitly by pushing while
 * main or master is checked out. Force-pushing a feature branch stays allowed.
 * Best effort on the command text (it unwraps `bash -c`, `env`, `$(…)`);
 * other tools rely on the §11 text alone.
 */
import { spawnSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PROTECTED = new Set(["main", "master"]);
const FORCE_FLAG =
	/^(--force(-with-lease(=.*)?|-if-includes)?|--mirror|-[a-zA-Z]*f[a-zA-Z]*)$/;
const DELETE_FLAG = /^(--delete|-d)$/;
/** push options that take a separate value (`-o x`, `--repo x`) */
const VALUE_OPTION = /^(-o|--push-option|--repo|--receive-pack|--exec)$/;
/** wrappers that run their arguments as a command */
const WRAPPER = /^(env|command|exec|eval|sudo|nohup|time)$/;

/** Flattens quoting and shell wrappers so `bash -c "git push …"` is seen. */
const normalize = (command) =>
	String(command)
		// heredoc bodies are data (file content), not commands
		.replace(
			/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g,
			"<<HEREDOC",
		)
		.replace(/\$\(|`/g, ";")
		.replace(/\b(ba|z|da)?sh\s+-c\s+/g, ";")
		.replace(/['"()]/g, " ");

/** The ref a refspec writes to: `src:dst` → dst, `+x` → x, `refs/heads/x` → x. */
const destination = (refspec) =>
	(refspec.replace(/^\+/, "").split(":").at(-1) ?? "").replace(
		/^refs\/heads\//,
		"",
	);

/**
 * Returns the protected branch a command would overwrite or delete, or null.
 * `currentBranch(dir)` resolves the checked-out branch (dir from `git -C`).
 */
export function check(command, { currentBranch = () => "" } = {}) {
	for (const segment of normalize(command).split(/\n|;|&&|\|\|?|&/)) {
		const words = segment.trim().split(/\s+/).filter(Boolean);
		let w = 0;
		while (
			w < words.length &&
			(/^\w+=/.test(words[w]) || WRAPPER.test(words[w]))
		)
			w++;
		if (words[w] !== "git") continue;
		let dir;
		let i = w + 1;
		while (i < words.length && words[i]?.startsWith("-")) {
			if (words[i] === "-C") dir = words[i + 1];
			i += words[i] === "-C" || words[i] === "-c" ? 2 : 1;
		}
		if (words[i] !== "push") continue;
		const flags = [];
		const positional = [];
		const args = words.slice(i + 1);
		for (let a = 0; a < args.length; a++) {
			const arg = args[a] ?? "";
			if (VALUE_OPTION.test(arg)) a++;
			else if (arg.startsWith("-")) flags.push(arg);
			else positional.push(arg);
		}
		const refspecs = positional.slice(1);
		const destructive =
			flags.some((f) => FORCE_FLAG.test(f) || DELETE_FLAG.test(f)) ||
			refspecs.some((r) => r.startsWith("+") || r.startsWith(":"));
		if (!destructive) continue;
		const targets = refspecs.length
			? refspecs.map((r) =>
					r === "HEAD" ? currentBranch(dir) : destination(r),
				)
			: [currentBranch(dir)];
		const hit = targets.find((t) => PROTECTED.has(t));
		if (hit) return hit;
	}
	return null;
}

/** True when this file is the process entry point (paths with spaces, symlinks). */
const isMain = () => {
	try {
		return (
			import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
		);
	} catch {
		return false;
	}
};

if (isMain()) {
	let event = {};
	try {
		event = JSON.parse(readFileSync(0, "utf8") || "{}");
	} catch {
		process.exit(0);
	}
	if (event.tool_name !== "Bash") process.exit(0);
	const cwd = event.cwd || process.cwd();
	const branch = check(event.tool_input?.command ?? "", {
		currentBranch: (dir) =>
			spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
				cwd: dir ? resolve(cwd, dir) : cwd,
				encoding: "utf8",
			}).stdout?.trim() ?? "",
	});
	if (branch) {
		process.stderr.write(
			`Blocked: overwriting or deleting \`${branch}\` on the remote is never allowed (AGENTS.md §11).\nPush a feature branch and open a pull request instead. If the remote moved, fetch and rebase or merge your branch — never overwrite \`${branch}\`.\n`,
		);
		process.exit(2);
	}
	process.exit(0);
}
