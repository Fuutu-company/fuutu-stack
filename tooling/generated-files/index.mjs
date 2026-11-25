#!/usr/bin/env node
/**
 * Generated files — produced by their tool's command, never written by
 * hand. The single list of rules, read by the Claude Code hook
 * (`.claude/hooks/protect-generated.mjs`), the arch guards and editor
 * tooling:
 *
 *   node tooling/generated-files/index.mjs --json
 *     → { schemaVersion: 1, rules: [{ id, label, command, pattern: { source, flags } }] }
 *
 * Add a rule for your own generated files here — `id` stable kebab-case,
 * `pattern` matches the path anywhere in a string (absolute or relative),
 * `command` is what to run instead of a hand edit.
 */

/** Version of the `--json` object. Bump only for breaking changes. */
export const SCHEMA_VERSION = 1;

export const GENERATED = [
	{
		id: "prisma-migrations",
		pattern: /(^|[\s/"'=])packages\/db\/prisma\/migrations\//,
		label: "Prisma migrations",
		command:
			"pnpm --filter @fuutu/db db:migrate --name <change> (add --create-only to review first). Never write or edit migration SQL; change the schema in packages/db/prisma/schema/ and regenerate. If a migration needs custom SQL, stop and ask the human.",
	},
	{
		id: "prisma-client",
		pattern: /(^|[\s/"'=])packages\/db\/prisma\/(generated|zod)\//,
		label: "Prisma client / Zod schemas",
		command: "pnpm db:generate",
	},
	{
		id: "port-slot-project",
		pattern: /(^|[\s/"'=])\.fuutu\/project\.json(?=$|[\s"';&|])/,
		label: "the port-slot project file",
		command: "pnpm ports set <slot> / pnpm ports reassign",
	},
	{
		id: "lockfile",
		pattern: /(^|[\s/"'=])pnpm-lock\.yaml(?=$|[\s"';&|])/,
		label: "the lockfile",
		command: "pnpm add / pnpm remove / pnpm install",
	},
	{
		id: "framework-types",
		pattern:
			/(^|[\s/"'=])next-env\.d\.ts(?=$|[\s"';&|])|(^|[\s/"'=])\.source\//,
		label: "Next.js / Fumadocs generated types",
		command: "pnpm check-types (runs next typegen and fumadocs-mdx)",
	},
];

/** The rule a file path falls under, or null. */
export function matchGeneratedPath(path) {
	const p = String(path ?? "");
	return GENERATED.find((g) => g.pattern.test(p)) ?? null;
}

// Shell heuristics — which command segments write into a path. Kept out of
// the JSON: tooling outside Claude Code only matches paths.

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

/** The rule a shell command writes into (redirect, in-place edit, copy), or null. */
export function matchGeneratedCommand(command) {
	const segments = stripHeredocs(String(command ?? "")).split(/\n|;|&&|\|\|?/);
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

/** The `--json` object: rules with their patterns as `{ source, flags }`. */
export function generatedRulesJson() {
	return {
		schemaVersion: SCHEMA_VERSION,
		rules: GENERATED.map(({ id, label, command, pattern }) => ({
			id,
			label,
			command,
			pattern: { source: pattern.source, flags: pattern.flags },
		})),
	};
}

if (import.meta.url === `file://${process.argv[1]}`) {
	const args = process.argv.slice(2);
	if (args.length !== 1 || args[0] !== "--json") {
		process.stdout.write(
			"usage: node tooling/generated-files/index.mjs --json\n",
		);
		process.exit(1);
	}
	process.stdout.write(`${JSON.stringify(generatedRulesJson(), null, 2)}\n`);
}
