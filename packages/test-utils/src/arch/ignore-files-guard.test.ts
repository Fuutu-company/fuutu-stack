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

/**
 * `.dockerignore` semantics for the patterns the kit uses: `#` comments,
 * `!` re-includes, `*` within a segment, `**` across segments, a pattern
 * also covers everything below it; the last matching line wins.
 */
function dockerIgnored(path: string, lines: readonly string[]): boolean {
	let ignored = false;
	for (const raw of lines) {
		const line = raw.trim();
		if (line === "" || line.startsWith("#")) continue;
		const negate = line.startsWith("!");
		const pattern = (negate ? line.slice(1) : line).replace(/^\//, "");
		const source = pattern
			.split("/")
			.map((part) =>
				part === "**"
					? ".*"
					: part
							.replace(/[.+^${}()|[\]\\]/g, "\\$&")
							.replace(/\?/g, "[^/]")
							.replace(/\*/g, "[^/]*"),
			)
			.join("/");
		if (new RegExp(`^${source}(/.*)?$`).test(path)) ignored = !negate;
	}
	return ignored;
}

describe(".dockerignore keeps every file the app build imports", () => {
	const lines = readFileSync(join(REPO_ROOT, ".dockerignore"), "utf8").split(
		"\n",
	);
	const tracked = execFileSync("git", ["ls-files"], {
		cwd: REPO_ROOT,
		encoding: "utf8",
	})
		.split("\n")
		.filter(Boolean);
	const trackedSet = new Set(tracked);
	const EXTENSIONS = ["", ".ts", ".tsx", ".d.mts", "/index.ts", "/index.tsx"];
	const resolve = (from: string, spec: string): string | undefined => {
		const base = join(from, "..", spec).replace(/\\/g, "/");
		return EXTENSIONS.map((ext) => `${base}${ext}`).find((candidate) =>
			trackedSet.has(candidate),
		);
	};

	it("matches the kit's own patterns as Docker does", () => {
		expect(dockerIgnored("apps/saas/tests/auth.spec.ts", lines)).toBe(true);
		expect(dockerIgnored("apps/saas/src/app/page.tsx", lines)).toBe(false);
		expect(dockerIgnored("apps/saas/.env.local", lines)).toBe(true);
	});

	for (const app of ["saas", "marketing", "docs"]) {
		it(`apps/${app}: no built source imports a file outside the build context`, () => {
			// What `next build` type-checks: the app's tracked .ts/.tsx files
			// that reach the build context.
			const sources = tracked.filter(
				(file) =>
					file.startsWith(`apps/${app}/`) &&
					/\.(ts|tsx|mts)$/.test(file) &&
					!dockerIgnored(file, lines),
			);
			const missing: string[] = [];
			for (const file of sources) {
				const text = readFileSync(join(REPO_ROOT, file), "utf8");
				for (const m of text.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g)) {
					const target = resolve(file, m[1] ?? "");
					if (target && dockerIgnored(target, lines)) {
						missing.push(`${file} → ${target}`);
					}
				}
			}
			expect(missing).toEqual([]);
		});
	}
});
