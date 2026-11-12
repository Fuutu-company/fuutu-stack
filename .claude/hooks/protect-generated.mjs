#!/usr/bin/env node
/**
 * Claude Code PreToolUse hook: generated files are produced by their tool's
 * command, never written by hand. Blocks Write/Edit/MultiEdit on generated
 * paths and Bash commands that write into them, and tells the agent which
 * command to run instead. Reading and the generator commands stay allowed.
 */
import { readFileSync } from "node:fs";

export const GENERATED = [
	{
		pattern: /(^|[\s/"'=])packages\/db\/prisma\/migrations\//,
		label: "Prisma migrations",
		command:
			"pnpm --filter @fuutu/db db:migrate --name <change> (add --create-only to review first). Never write or edit migration SQL; change the schema in packages/db/prisma/schema/ and regenerate. If a migration needs custom SQL, stop and ask the human.",
	},
	{
		pattern: /(^|[\s/"'=])packages\/db\/prisma\/(generated|zod)\//,
		label: "Prisma client / Zod schemas",
		command: "pnpm db:generate",
	},
	{
		pattern: /(^|[\s/"'=])pnpm-lock\.yaml(?=$|[\s"';&|])/,
		label: "the lockfile",
		command: "pnpm add / pnpm remove / pnpm install",
	},
	{
		pattern:
			/(^|[\s/"'=])next-env\.d\.ts(?=$|[\s"';&|])|(^|[\s/"'=])\.source\//,
		label: "Next.js / Fumadocs generated types",
		command: "pnpm check-types (runs next typegen and fumadocs-mdx)",
	},
];

/** Commands that modify every file named in the same command segment. */
const MODIFIES =
	/\btee\b|\bsed\s+(-[a-zA-Z]*i|--in-place)|\bperl\s+-[a-zA-Z]*i|\b(mv|rm|touch|truncate)\s/;
/** Commands that only modify their last argument (the destination). */
const COPIES = /\b(cp|install|ln)\s/;

/** Heredoc bodies are data (file content), not targets — drop them. */
const stripHeredocs = (command) =>
	command.replace(
		/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g,
		"<<HEREDOC",
	);

function bashTarget(command) {
	const segments = stripHeredocs(command).split(/\n|;|&&|\|\|?/);
	for (const segment of segments) {
		for (const g of GENERATED) {
			// `> path` / `>> path` redirect into a generated file
			for (const m of segment.matchAll(/>>?\s*(\S+)/g)) {
				if (g.pattern.test(` ${m[1]}`)) return g;
			}
			if (MODIFIES.test(segment) && g.pattern.test(segment)) return g;
			if (COPIES.test(segment)) {
				const destination = segment.trim().split(/\s+/).at(-1) ?? "";
				if (g.pattern.test(` ${destination}`)) return g;
			}
		}
	}
	return null;
}

export function check(toolName, input) {
	if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) {
		const path = String(input.file_path ?? input.notebook_path ?? "");
		return GENERATED.find((g) => g.pattern.test(path)) ?? null;
	}
	if (toolName === "Bash") return bashTarget(String(input.command ?? ""));
	return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	let event = {};
	try {
		event = JSON.parse(readFileSync(0, "utf8") || "{}");
	} catch {
		process.exit(0);
	}
	const hit = check(event.tool_name, event.tool_input ?? {});
	if (hit) {
		process.stderr.write(
			`Blocked: ${hit.label} are generated — never create or change them by hand.\nRun instead: ${hit.command}\n`,
		);
		process.exit(2);
	}
	process.exit(0);
}
