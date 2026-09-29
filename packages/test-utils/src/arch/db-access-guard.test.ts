import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: ensures no code outside packages/db/ imports the raw Prisma client directly.
 * All DB access must go through the query layer (@fuutu/db exports only query functions).
 *
 * This is a static analysis test — no DB connection needed.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const PACKAGES_DIR = join(REPO_ROOT, "packages");
const APPS_DIR = join(REPO_ROOT, "apps");

// Allowlist: packages that are permitted to import the raw client
const ALLOWLIST_RAW_CLIENT = new Set(["auth"]);

// `[\s\S]*` (not `.*`) so a newline between `import` and `{` cannot evade
// detection, e.g. `import type\n{ db }\nfrom "@fuutu/db"`.
const RAW_DB_IMPORT_RE =
	/import\s+[\s\S]*\{[^}]*\bdb\b[^}]*\}\s+from\s+["']@fuutu\/db["']/;

describe("DB access guard", () => {
	it("should not import raw Prisma client from public API", () => {
		const violations: string[] = [];

		scanTsFiles(APPS_DIR, (filePath, content) => {
			// Skip this test file itself
			if (filePath.includes("db-access-guard.test.ts")) return;

			// Fail if importing { db } from "@fuutu/db" (raw client from public API)
			if (RAW_DB_IMPORT_RE.test(content)) {
				violations.push(`${filePath}: imports { db } from "@fuutu/db"`);
			}
		});

		scanTsFiles(PACKAGES_DIR, (filePath, content) => {
			// Skip packages/db itself, packages/auth (allowlist), and this test file
			if (filePath.includes("packages/db/")) return;
			if (filePath.includes("packages/auth/")) return;
			if (filePath.includes("db-access-guard.test.ts")) return;

			// Fail if importing { db } from "@fuutu/db" (raw client from public API)
			if (RAW_DB_IMPORT_RE.test(content)) {
				violations.push(`${filePath}: imports { db } from "@fuutu/db"`);
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

			if (content.includes('from "@fuutu/db/prisma/client"')) {
				violations.push(
					`${filePath}: deep import from "@fuutu/db/prisma/client"`,
				);
			}
		});

		scanTsFiles(PACKAGES_DIR, (filePath, content) => {
			// Skip packages/db itself and this test file
			if (filePath.includes("packages/db/")) return;
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (content.includes('from "@fuutu/db/prisma/client"')) {
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

			if (content.includes('from "@fuutu/db/internal/client"')) {
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
				content.includes('from "@fuutu/db/internal/client"') &&
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

			if (content.includes('from "@prisma/client"')) {
				violations.push(`${filePath}: imports from "@prisma/client"`);
			}
		});

		scanTsFiles(PACKAGES_DIR, (filePath, content) => {
			// Skip packages/db itself and this test file
			if (filePath.includes("packages/db/")) return;
			if (filePath.includes("db-access-guard.test.ts")) return;

			if (content.includes('from "@prisma/client"')) {
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
			// Skip node_modules and build outputs
			if (
				entry.name === "node_modules" ||
				entry.name === ".next" ||
				entry.name === ".turbo" ||
				entry.name === "coverage"
			) {
				continue;
			}
			scanTsFiles(fullPath, callback);
		} else if (
			entry.isFile() &&
			(entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
		) {
			const content = readFileSync(fullPath, "utf-8");
			const relativePath = relative(REPO_ROOT, fullPath);
			callback(relativePath, content);
		}
	}
}
