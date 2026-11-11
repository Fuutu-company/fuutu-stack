import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: team agents in `.claude/agents/` stay consistent.
 *
 * - `tier` is the vendor-neutral source of truth (strong | balanced | fast);
 *   `model` must be the Claude model mapped to that tier — other tools
 *   translate the tier via AI-SETUP.md.
 * - Preloaded `skills` must exist in `.claude/skills/`.
 * - Read-only roles must not be granted write tools.
 * - Every agent is listed in the AGENTS.md team table.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const AGENTS_DIR = join(REPO_ROOT, ".claude", "agents");
const SKILLS_DIR = join(REPO_ROOT, ".claude", "skills");

const TIER_MODEL: Record<string, string> = {
	strong: "opus",
	balanced: "sonnet",
	fast: "haiku",
};
const READ_ONLY = new Set(["scout", "reviewer", "security"]);
const WRITE_TOOLS = ["Edit", "Write", "NotebookEdit"];

function frontmatter(source: string): Record<string, string> {
	const block = /^---\n([\s\S]*?)\n---/.exec(source)?.[1] ?? "";
	const fields: Record<string, string> = {};
	for (const line of block.split("\n")) {
		const match = /^([\w-]+):\s*(.*)$/.exec(line);
		if (match?.[1]) fields[match[1]] = match[2] ?? "";
	}
	return fields;
}

const agentFiles = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));
const agentsMd = readFileSync(join(REPO_ROOT, "AGENTS.md"), "utf8");

describe("team agents guard", () => {
	it("ships the team", () => {
		expect(agentFiles.length).toBeGreaterThanOrEqual(8);
	});

	for (const file of agentFiles) {
		const fields = frontmatter(readFileSync(join(AGENTS_DIR, file), "utf8"));
		const name = file.replace(/\.md$/, "");

		describe(name, () => {
			it("has name, a 'Use …' description and a tier-matched model", () => {
				expect(fields.name).toBe(name);
				expect(fields.description).toMatch(/^Use /);
				expect(fields.tier).toBeDefined();
				expect(TIER_MODEL[fields.tier ?? ""]).toBe(fields.model);
			});

			it("preloads only skills that exist", () => {
				const skills = (fields.skills ?? "")
					.replace(/[[\]]/g, "")
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean);
				for (const skill of skills) {
					expect(existsSync(join(SKILLS_DIR, skill, "SKILL.md"))).toBe(true);
				}
			});

			if (READ_ONLY.has(name)) {
				it("is read-only", () => {
					const tools = (fields.tools ?? "").split(",").map((t) => t.trim());
					expect(fields.tools).toBeDefined();
					for (const tool of WRITE_TOOLS) expect(tools).not.toContain(tool);
				});
			}

			it("is listed in the AGENTS.md team table", () => {
				expect(agentsMd).toContain(`| \`${name}\` |`);
			});
		});
	}
});
