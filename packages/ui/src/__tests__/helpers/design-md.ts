import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type YamlValue = string | { [key: string]: YamlValue };
export type YamlMap = { [key: string]: YamlValue };

export const DESIGN_MD = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../../../DESIGN.md",
);

export function readDesignMd(): string {
	return readFileSync(DESIGN_MD, "utf8");
}

/** Split a document into its `---` frontmatter and the markdown body. */
export function splitFrontmatter(md: string): { front: string; body: string } {
	const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(md);
	if (!match) throw new Error("DESIGN.md has no YAML frontmatter");
	return { front: match[1] ?? "", body: match[2] ?? "" };
}

function parseScalar(raw: string, line: string): string {
	const quoted = /^"((?:[^"\\]|\\.)*)"$/.exec(raw);
	if (!quoted) throw new Error(`Value must be a double-quoted string: ${line}`);
	return (quoted[1] ?? "").replace(/\\(["\\])/g, "$1");
}

/**
 * Parses the YAML subset DESIGN.md uses: nested maps indented by 2 spaces,
 * `key:` for a map, `key: "value"` for a string. Comments and blank lines are skipped.
 */
export function parseYamlSubset(src: string): YamlMap {
	const root: YamlMap = {};
	const stack: { indent: number; map: YamlMap }[] = [{ indent: -1, map: root }];

	for (const line of src.split("\n")) {
		if (!line.trim() || line.trim().startsWith("#")) continue;
		const match = /^( *)([\w.-]+):(?: (.*))?$/.exec(line);
		if (!match) throw new Error(`Unsupported frontmatter line: ${line}`);
		const indent = (match[1] ?? "").length;
		if (indent % 2 !== 0) throw new Error(`Odd indentation: ${line}`);
		const key = match[2] as string;
		const rest = match[3]?.trim();

		while (stack.length > 1 && indent <= (stack.at(-1)?.indent ?? -1)) {
			stack.pop();
		}
		const parent = stack.at(-1)?.map;
		if (!parent) throw new Error(`Bad nesting: ${line}`);

		if (rest === undefined || rest === "") {
			const child: YamlMap = {};
			parent[key] = child;
			stack.push({ indent, map: child });
		} else {
			parent[key] = parseScalar(rest, line);
		}
	}
	return root;
}

export function asMap(value: YamlValue | undefined, path: string): YamlMap {
	if (value === undefined || typeof value === "string") {
		throw new Error(`${path} must be a map`);
	}
	return value;
}

/** Flatten a map of strings, normalising whitespace. */
export function stringEntries(map: YamlMap): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(map)) {
		if (typeof v !== "string") throw new Error(`${k} must be a string`);
		out[k] = v.replace(/\s+/g, " ").trim();
	}
	return out;
}

/** Level-2 headings of the body, in order. */
export function bodyHeadings(body: string): string[] {
	return [...body.matchAll(/^## (.+)$/gm)].map((m) => (m[1] ?? "").trim());
}

/** Text of one `## ` section (without its heading). */
export function sectionOf(body: string, heading: string): string {
	const lines = body.split("\n");
	const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
	if (start === -1) return "";
	const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
	return lines.slice(start + 1, end === -1 ? undefined : end).join("\n");
}
