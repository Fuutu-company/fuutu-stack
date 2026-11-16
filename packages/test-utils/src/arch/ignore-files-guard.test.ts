import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Secrets stay out of git and out of the Docker build context: every
 * `.env.*` file except the committed `.env.example` is ignored, and the
 * build context skips local agent tooling (worktrees, private overlays).
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");

function gitIgnores(path: string): boolean {
	try {
		execFileSync("git", ["check-ignore", "--no-index", "-q", path], {
			cwd: REPO_ROOT,
		});
		return true;
	} catch {
		return false;
	}
}

describe(".gitignore", () => {
	it.each([
		".env",
		".env.production",
		".env.staging",
		".env.local",
		"apps/saas/.env.production",
	])("ignores %s", (path) => {
		expect(gitIgnores(path)).toBe(true);
	});

	it("keeps .env.example tracked", () => {
		expect(gitIgnores(".env.example")).toBe(false);
	});
});

describe(".dockerignore", () => {
	const entries = readFileSync(join(REPO_ROOT, ".dockerignore"), "utf8")
		.split("\n")
		.map((line) => line.trim());

	it.each([".claude", "CLAUDE.local.md"])(
		"leaves %s out of the build context",
		(entry) => {
			expect(entries).toContain(entry);
		},
	);
});
