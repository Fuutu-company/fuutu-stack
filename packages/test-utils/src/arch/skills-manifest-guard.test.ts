import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: `fuutu.skills.json` and `.claude/skills/` stay consistent.
 *
 * - source "repo": a full skill ships in the repo.
 * - source "mcp":  a stub ships in the repo so agents discover the skill
 *   by its description; the stub must delegate to `skills_get` and keep a
 *   no-MCP fallback, so the kit stays usable without a subscription.
 * - `.agents/skills` mirrors `.claude/skills` for non-Claude agents.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const SKILLS_DIR = join(REPO_ROOT, ".claude", "skills");

type Entry = { name: string; source: "repo" | "mcp"; category: string };

const manifest = JSON.parse(
	readFileSync(join(REPO_ROOT, "fuutu.skills.json"), "utf8"),
) as { skills: Entry[] };

function frontmatter(source: string): Record<string, string> {
	const block = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
	const fields: Record<string, string> = {};
	for (const line of block.split("\n")) {
		const match = /^\s*([\w-]+):\s*(.*)$/.exec(line);
		if (match?.[1]) fields[match[1]] = match[2] ?? "";
	}
	return fields;
}

describe("skills manifest guard", () => {
	it("has unique skill names", () => {
		const names = manifest.skills.map((s) => s.name);
		expect(new Set(names).size).toBe(names.length);
	});

	for (const entry of manifest.skills) {
		describe(entry.name, () => {
			const path = join(SKILLS_DIR, entry.name, "SKILL.md");

			it("ships a SKILL.md whose frontmatter matches the manifest", () => {
				expect(existsSync(path)).toBe(true);
				const fields = frontmatter(readFileSync(path, "utf8"));
				expect(fields.name).toBe(entry.name);
				expect(fields.description?.length ?? 0).toBeGreaterThan(40);
				expect(fields["fuutu-source"]).toBe(entry.source);
				expect(fields["fuutu-category"]).toBe(entry.category);
			});

			if (entry.source === "mcp") {
				it("stub delegates to skills_get and keeps a no-MCP fallback", () => {
					const body = readFileSync(path, "utf8");
					expect(body).toContain(`"name": "${entry.name}"`);
					expect(body).toContain("skills_get");
					expect(body).toMatch(/Otherwise/);
				});
			}
		});
	}

	it("names every manifest skill in AGENTS.md", () => {
		const agentsMd = readFileSync(join(REPO_ROOT, "AGENTS.md"), "utf8");
		for (const entry of manifest.skills) {
			expect(agentsMd, entry.name).toContain(`\`${entry.name}\``);
		}
	});

	it(".agents/skills is a symlink to .claude/skills", () => {
		const link = join(REPO_ROOT, ".agents", "skills");
		expect(lstatSync(link).isSymbolicLink()).toBe(true);
		expect(readlinkSync(link)).toBe("../.claude/skills");
	});
});
