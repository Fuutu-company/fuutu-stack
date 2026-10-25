import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: ensures no code outside packages/db/ imports the raw Prisma client directly.
 * All DB access must go through the query layer (@fuutu/db exports only query functions).
 *
 * This is a static analysis test — no DB connection needed.
 * Residual limits: heuristic regex scan — misses member-access dynamic imports
 * (`(await import("@fuutu/db")).db`, `const m = await import(...); m.db`) and
 * false-positives on the literal pattern inside a comment or string.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const PACKAGES_DIR = join(REPO_ROOT, "packages");
const APPS_DIR = join(REPO_ROOT, "apps");

// Allowlist: packages that are permitted to import the raw client
const ALLOWLIST_RAW_CLIENT = new Set(["auth"]);

// Intentionally NOT anchored on `import` — matches both
// `import { db } from "@fuutu/db"` and `export { db } from "@fuutu/db"`
// so a pure re-export barrel cannot evade detection. `[^}]*` (not `.*`)
// still tolerates newlines inside the braces.
const RAW_DB_IMPORT_RE = /\{[^}]*\bdb\b[^}]*\}\s*from\s*["']@fuutu\/db["']/;

// `export * from "@fuutu/db"` re-exports everything the barrel exports —
// including `db` if it is ever added. `export * as ns` exposes it as `ns.db`.
// `\w+\s+` keeps `\s+` where identifier chars would otherwise merge (`asns`,
// `nsfrom`); punctuation-adjacent positions use `\s*` (`export*x`, `from"x"`).
const RAW_DB_EXPORT_RE =
	/export\s*\*(?:\s*as\s+\w+)?\s*from\s*["']@fuutu\/db["']/;

// `import * as ns from "@fuutu/db"` exposes `ns.db` — same violation.
const RAW_DB_NAMESPACE_RE =
	/import\s*\*\s*as\s+\w+\s+from\s*["']@fuutu\/db["']/;

// Deep-path / raw-client specifiers — `["']` tolerates single quotes, `\s*`
// any whitespace between `from` and the specifier, and `(?:\/[^"']*)?` an
// optional subpath (`@prisma/client/runtime/library`).
const DEEP_PRISMA_CLIENT_RE =
	/from\s*["']@fuutu\/db\/prisma\/client(?:\/[^"']*)?["']/;
const DEEP_INTERNAL_CLIENT_RE =
	/from\s*["']@fuutu\/db\/internal\/client(?:\/[^"']*)?["']/;
const RAW_PRISMA_IMPORT_RE = /from\s*["']@prisma\/client(?:\/[^"']*)?["']/;

// Dynamic-import equivalents. A bare `await import("@fuutu/db")` is benign
// (tests destructure query fns from it) — only flag it when `db` itself is
// destructured. The deep paths and @prisma/client are always violations.
const DYNAMIC_DB_DESTRUCTURE_RE =
	/\{[^}]*\bdb\b[^}]*\}\s*=\s*(?:await\s+)?import\s*\(\s*["']@fuutu\/db["']\s*\)/;
const DYNAMIC_PRISMA_CLIENT_RE =
	/import\s*\(\s*["']@fuutu\/db\/prisma\/client(?:\/[^"']*)?["']\s*\)/;
const DYNAMIC_INTERNAL_CLIENT_RE =
	/import\s*\(\s*["']@fuutu\/db\/internal\/client(?:\/[^"']*)?["']\s*\)/;
const DYNAMIC_PRISMA_PKG_RE =
	/import\s*\(\s*["']@prisma\/client(?:\/[^"']*)?["']\s*\)/;

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

describe("DB access guard", () => {
	it("should not import raw Prisma client from public API", () => {
		const violations: string[] = [];

		scanTsFiles(APPS_DIR, (filePath, content) => {
			// Skip this test file itself
			if (filePath.includes("db-access-guard.test.ts")) return;

			// Fail if importing/re-exporting { db } from "@fuutu/db"
			if (RAW_DB_IMPORT_RE.test(content)) {
				violations.push(`${filePath}: imports { db } from "@fuutu/db"`);
			}
			// Fail on `export * from "@fuutu/db"` (barrel re-export exposes db)
			if (RAW_DB_EXPORT_RE.test(content)) {
				violations.push(`${filePath}: re-exports * from "@fuutu/db"`);
			}
			// Fail on `import * as ns from "@fuutu/db"` (exposes ns.db)
			if (RAW_DB_NAMESPACE_RE.test(content)) {
				violations.push(
					`${filePath}: namespace import of "@fuutu/db" exposes db`,
				);
			}
			// Fail on `const { db } = await import("@fuutu/db")`
			if (DYNAMIC_DB_DESTRUCTURE_RE.test(content)) {
				violations.push(
					`${filePath}: destructures { db } from import("@fuutu/db")`,
				);
			}
		});

		scanTsFiles(PACKAGES_DIR, (filePath, content) => {
			// Skip packages/db itself, packages/auth (allowlist), and this test file
			if (filePath.includes("packages/db/")) return;
			if (filePath.includes("packages/auth/")) return;
			if (filePath.includes("db-access-guard.test.ts")) return;

			// Fail if importing/re-exporting { db } from "@fuutu/db"
			if (RAW_DB_IMPORT_RE.test(content)) {
				violations.push(`${filePath}: imports { db } from "@fuutu/db"`);
			}
			// Fail on `export * from "@fuutu/db"` (barrel re-export exposes db)
			if (RAW_DB_EXPORT_RE.test(content)) {
				violations.push(`${filePath}: re-exports * from "@fuutu/db"`);
			}
			// Fail on `import * as ns from "@fuutu/db"` (exposes ns.db)
			if (RAW_DB_NAMESPACE_RE.test(content)) {
				violations.push(
					`${filePath}: namespace import of "@fuutu/db" exposes db`,
				);
			}
			// Fail on `const { db } = await import("@fuutu/db")`
			if (DYNAMIC_DB_DESTRUCTURE_RE.test(content)) {
				violations.push(
					`${filePath}: destructures { db } from import("@fuutu/db")`,
				);
			}
		});

		if (violations.length > 0) {
			throw new Error(
				`DB access guard violations:\n${violations.map((v) => `  - ${v}`).join("\n")}\n\nUse query functions from @fuutu/db instead.`,
			);
		}
	});

	it("should not use deep imports to @fuutu/db/prisma/client", () => {
		const violations: string[] = [];

		scanTsFiles(APPS_DIR, (filePath, content) => {
			// Skip this test file itself
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (
				DEEP_PRISMA_CLIENT_RE.test(content) ||
				DYNAMIC_PRISMA_CLIENT_RE.test(content)
			) {
				violations.push(
					`${filePath}: deep import from "@fuutu/db/prisma/client"`,
				);
			}
		});

		scanTsFiles(PACKAGES_DIR, (filePath, content) => {
			// Skip packages/db itself and this test file
			if (filePath.includes("packages/db/")) return;
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (
				DEEP_PRISMA_CLIENT_RE.test(content) ||
				DYNAMIC_PRISMA_CLIENT_RE.test(content)
			) {
				violations.push(
					`${filePath}: deep import from "@fuutu/db/prisma/client"`,
				);
			}
		});

		if (violations.length > 0) {
			throw new Error(
				`DB access guard violations:\n${violations.map((v) => `  - ${v}`).join("\n")}\n\nUse query functions from @fuutu/db instead.`,
			);
		}
	});

	it("should not import from internal client except in allowlist", () => {
		const violations: string[] = [];

		scanTsFiles(APPS_DIR, (filePath, content) => {
			// Skip this test file itself
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (
				DEEP_INTERNAL_CLIENT_RE.test(content) ||
				DYNAMIC_INTERNAL_CLIENT_RE.test(content)
			) {
				violations.push(
					`${filePath}: imports from "@fuutu/db/internal/client"`,
				);
			}
		});

		scanTsFiles(PACKAGES_DIR, (filePath, content) => {
			// Skip packages/db itself and this test file
			if (filePath.includes("packages/db/")) return;
			if (filePath.includes("db-access-guard.test.ts")) return;

			// Check if file is in allowlist
			const isInAllowlist = ALLOWLIST_RAW_CLIENT.has(
				filePath.split("packages/")[1]?.split("/")[0] ?? "",
			);

			if (
				(DEEP_INTERNAL_CLIENT_RE.test(content) ||
					DYNAMIC_INTERNAL_CLIENT_RE.test(content)) &&
				!isInAllowlist
			) {
				violations.push(
					`${filePath}: imports from "@fuutu/db/internal/client" (not in allowlist)`,
				);
			}
		});

		if (violations.length > 0) {
			throw new Error(
				`DB access guard violations:\n${violations.map((v) => `  - ${v}`).join("\n")}\n\nOnly packages in allowlist may import internal client: ${Array.from(ALLOWLIST_RAW_CLIENT).join(", ")}`,
			);
		}
	});

	it("should not import directly from @prisma/client", () => {
		const violations: string[] = [];

		scanTsFiles(APPS_DIR, (filePath, content) => {
			// Skip this test file itself
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (
				RAW_PRISMA_IMPORT_RE.test(content) ||
				DYNAMIC_PRISMA_PKG_RE.test(content)
			) {
				violations.push(`${filePath}: imports from "@prisma/client"`);
			}
		});

		scanTsFiles(PACKAGES_DIR, (filePath, content) => {
			// Skip packages/db itself and this test file
			if (filePath.includes("packages/db/")) return;
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (
				RAW_PRISMA_IMPORT_RE.test(content) ||
				DYNAMIC_PRISMA_PKG_RE.test(content)
			) {
				violations.push(`${filePath}: imports from "@prisma/client"`);
			}
		});

		if (violations.length > 0) {
			throw new Error(
				`DB access guard violations:\n${violations.map((v) => `  - ${v}`).join("\n")}\n\nUse query functions from @fuutu/db instead.`,
			);
		}
	});

	it("should not instantiate PrismaClient outside packages/db", () => {
		const violations: string[] = [];

		scanTsFiles(APPS_DIR, (filePath, content) => {
			// Skip this test file itself
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (/new\s+PrismaClient\s*\(/.test(content)) {
				violations.push(`${filePath}: instantiates PrismaClient`);
			}
		});

		scanTsFiles(PACKAGES_DIR, (filePath, content) => {
			// Skip packages/db itself and this test file
			if (filePath.includes("packages/db/")) return;
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (/new\s+PrismaClient\s*\(/.test(content)) {
				violations.push(`${filePath}: instantiates PrismaClient`);
			}
		});

		if (violations.length > 0) {
			throw new Error(
				`DB access guard violations:\n${violations.map((v) => `  - ${v}`).join("\n")}\n\nUse the singleton from @fuutu/db/internal/client instead.`,
			);
		}
	});
	describe("raw-import regex fixtures", () => {
		it("detects a multiline { db } import", () => {
			expect(
				RAW_DB_IMPORT_RE.test('import {\n\tdb,\n} from "@fuutu/db";'),
			).toBe(true);
		});

		it("detects a newline between `import` and `{`", () => {
			expect(
				RAW_DB_IMPORT_RE.test('import type\n\t{ db }\n\tfrom "@fuutu/db";'),
			).toBe(true);
		});

		it("detects a single-line { db } import", () => {
			expect(RAW_DB_IMPORT_RE.test('import { db } from "@fuutu/db";')).toBe(
				true,
			);
		});

		it("ignores non-db named imports from @fuutu/db", () => {
			expect(
				RAW_DB_IMPORT_RE.test('import { getUser } from "@fuutu/db";'),
			).toBe(false);
		});

		it("ignores db imports from other packages", () => {
			expect(RAW_DB_IMPORT_RE.test('import { db } from "@fuutu/other";')).toBe(
				false,
			);
		});

		it("detects a { db } import with no space before `from`", () => {
			expect(RAW_DB_IMPORT_RE.test('import { db }from "@fuutu/db";')).toBe(
				true,
			);
		});

		it("detects a pure { db } re-export", () => {
			expect(RAW_DB_IMPORT_RE.test('export { db } from "@fuutu/db";')).toBe(
				true,
			);
		});

		it("detects an `export *` barrel from @fuutu/db", () => {
			expect(RAW_DB_EXPORT_RE.test('export * from "@fuutu/db";')).toBe(true);
			expect(RAW_DB_EXPORT_RE.test('export*as ns from"@fuutu/db";')).toBe(true);
		});

		it("detects a namespace import of @fuutu/db", () => {
			expect(RAW_DB_NAMESPACE_RE.test('import * as ns from "@fuutu/db";')).toBe(
				true,
			);
		});

		it("detects a dynamic import of the internal client", () => {
			expect(
				DYNAMIC_INTERNAL_CLIENT_RE.test(
					'const c = await import("@fuutu/db/internal/client");',
				),
			).toBe(true);
		});

		it("detects a { db } destructure from a dynamic @fuutu/db import", () => {
			expect(
				DYNAMIC_DB_DESTRUCTURE_RE.test(
					'const { db } = await import("@fuutu/db");',
				),
			).toBe(true);
		});

		it("ignores query-fn destructures from a dynamic @fuutu/db import", () => {
			const src = 'const { getUser } = await import("@fuutu/db");';
			expect(RAW_DB_IMPORT_RE.test(src)).toBe(false);
			expect(DYNAMIC_DB_DESTRUCTURE_RE.test(src)).toBe(false);
		});

		it("detects a bare dynamic import of the internal client", () => {
			expect(
				DYNAMIC_INTERNAL_CLIENT_RE.test(
					'await import("@fuutu/db/internal/client");',
				),
			).toBe(true);
		});

		it("detects a single-quoted @prisma/client import", () => {
			expect(
				RAW_PRISMA_IMPORT_RE.test("import { x } from '@prisma/client';"),
			).toBe(true);
		});

		it("detects a @prisma/client subpath import", () => {
			expect(
				RAW_PRISMA_IMPORT_RE.test(
					'import { x } from "@prisma/client/runtime/library";',
				),
			).toBe(true);
			expect(
				DYNAMIC_PRISMA_PKG_RE.test('await import("@prisma/client/x");'),
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
