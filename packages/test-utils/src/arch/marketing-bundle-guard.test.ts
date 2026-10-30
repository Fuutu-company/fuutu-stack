import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: apps/marketing must stay bundle-clean (AGENTS.md §6).
 * Server-only packages must never be imported into the public marketing
 * bundle — not even type-only — because they leak server code/types into
 * a public app and pull in DB/auth/env dependencies.
 *
 * Banned import sources in apps/marketing source files:
 *   - "better-auth"          (auth server + client internals)
 *   - "@prisma/client"       (DB client — all access via @fuutu/db in saas)
 *   - "@fuutu/api"           (oRPC server bundle)
 *   - "@fuutu/env/saas"      (server env schema — marketing uses
 *                             @fuutu/env/marketing only)
 *
 * This is a static analysis test — no build needed.
 * Residual limits: heuristic regex scan — false-positives on the literal
 * pattern inside a comment or string are possible; misses obfuscated
 * dynamic specifiers.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const MARKETING_DIR = join(REPO_ROOT, "apps", "marketing");

// One regex per banned source. `(?:from|import|require)\s*\(?\s*["']`
// covers `… from "x"`, `import "x"` (side-effect), `import("x")`, and
// `require("x")`. `(?:\/[^"']*)?` matches subpaths so
// "@prisma/client/runtime/library" is caught too.
const BETTER_AUTH_RE =
	/(?:from|import|require)\s*\(?\s*["']better-auth(?:\/[^"']*)?["']/;
const PRISMA_CLIENT_RE =
	/(?:from|import|require)\s*\(?\s*["']@prisma\/client(?:\/[^"']*)?["']/;
const FUUTU_API_RE =
	/(?:from|import|require)\s*\(?\s*["']@fuutu\/api(?:\/[^"']*)?["']/;
const ENV_SAAS_RE =
	/(?:from|import|require)\s*\(?\s*["']@fuutu\/env\/saas(?:\/[^"']*)?["']/;

const BANNED_SOURCES: ReadonlyArray<{ label: string; re: RegExp }> = [
	{ label: "better-auth", re: BETTER_AUTH_RE },
	{ label: "@prisma/client", re: PRISMA_CLIENT_RE },
	{ label: "@fuutu/api", re: FUUTU_API_RE },
	{ label: "@fuutu/env/saas", re: ENV_SAAS_RE },
];

// Directories never scanned: dependencies, build outputs, generated code,
// and tool reports.
const SKIP_DIRS = new Set([
	"node_modules",
	".next",
	".turbo",
	"coverage",
	"dist",
	"generated",
	"out",
	"coverage-v8",
	"playwright-report",
	"test-results",
	".git",
	".fuutu",
]);

describe("marketing bundle guard", () => {
	it("apps/marketing exists (fail loud on missing/unreadable dir)", () => {
		expect(existsSync(MARKETING_DIR)).toBe(true);
	});

	it("should not import server-only packages into apps/marketing", () => {
		const violations: string[] = [];

		scanTsFiles(MARKETING_DIR, (filePath, content) => {
			for (const { label, re } of BANNED_SOURCES) {
				if (re.test(content)) {
					violations.push(`${filePath}: imports banned source "${label}"`);
				}
			}
		});

		if (violations.length > 0) {
			throw new Error(
				`Marketing bundle guard violations:\n${violations.map((v) => `  - ${v}`).join("\n")}\n\napps/marketing must stay server-clean (AGENTS.md §6): no better-auth, @prisma/client, @fuutu/api, or @fuutu/env/saas — not even type-only.`,
			);
		}
	});

	describe("banned-source regex fixtures", () => {
		it("detects a static better-auth import", () => {
			expect(BETTER_AUTH_RE.test('import { x } from "better-auth";')).toBe(
				true,
			);
		});

		it("detects a better-auth subpath import", () => {
			expect(
				BETTER_AUTH_RE.test('import { x } from "better-auth/react";'),
			).toBe(true);
		});

		it("detects a type-only banned import (type imports are banned too)", () => {
			expect(
				ENV_SAAS_RE.test('import type { env } from "@fuutu/env/saas";'),
			).toBe(true);
		});

		it("detects a @prisma/client subpath import", () => {
			expect(
				PRISMA_CLIENT_RE.test(
					'import { x } from "@prisma/client/runtime/library";',
				),
			).toBe(true);
		});

		it("detects a side-effect import", () => {
			expect(FUUTU_API_RE.test('import "@fuutu/api";')).toBe(true);
		});

		it("detects a dynamic import", () => {
			expect(FUUTU_API_RE.test('const m = await import("@fuutu/api");')).toBe(
				true,
			);
		});

		it("detects a require() call", () => {
			expect(BETTER_AUTH_RE.test('const m = require("better-auth");')).toBe(
				true,
			);
		});

		it("detects an export-from re-export", () => {
			expect(ENV_SAAS_RE.test('export { env } from "@fuutu/env/saas";')).toBe(
				true,
			);
		});

		it("ignores the literal string outside an import context", () => {
			expect(BETTER_AUTH_RE.test('const id = "better-auth";')).toBe(false);
		});

		it("ignores @fuutu/env/marketing (allowed env entrypoint)", () => {
			expect(
				ENV_SAAS_RE.test('import { env } from "@fuutu/env/marketing";'),
			).toBe(false);
		});

		it("ignores similarly-prefixed packages (@fuutu/api-keys)", () => {
			expect(FUUTU_API_RE.test('import { x } from "@fuutu/api-keys";')).toBe(
				false,
			);
		});

		it("ignores unrelated better-auth mentions in strings", () => {
			expect(
				BANNED_SOURCES.every(
					({ re }) =>
						!re.test('logo: "/logo/better-auth.svg", id: "better-auth"'),
				),
			).toBe(true);
		});
	});
});

function scanTsFiles(
	dir: string,
	callback: (filePath: string, content: string) => void,
): void {
	// Fail loud: an unreadable dir must error the test, not silently pass.
	const entries = readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) {
				continue;
			}
			scanTsFiles(fullPath, callback);
		} else if (
			entry.isFile() &&
			(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
			!entry.name.endsWith(".d.ts")
		) {
			const content = readFileSync(fullPath, "utf-8");
			// Normalize to "/" so the checks below work on Windows paths too
			const relativePath = relative(REPO_ROOT, fullPath).split(sep).join("/");
			callback(relativePath, content);
		}
	}
}
