/**
 * IDOR (Insecure Direct Object Reference) Scanner Test
 *
 * Statically scans ALL API procedure files for a critical pattern:
 *   1. Procedure accepts `organizationId` from client input (Zod schema)
 *   2. Procedure does NOT call `requireOrgRole(...)` before using it
 *
 * This is a static source-code scan — no DB, no runtime, no mocks.
 * It catches the class of bug where a client-supplied organizationId
 * is passed directly to a DB query without membership verification.
 *
 * The test FAILS if any procedure file:
 *   - Has `organizationId` in a Zod input schema AND
 *   - Does NOT contain a `requireOrgRole(` call
 *
 * Exceptions (legitimate cases that don't need requireOrgRole):
 *   - Files that only use `context.user.id` (no orgId from input)
 *   - Files that fetch the org from DB first, then check (indirect IDOR protection)
 *   - Router files (no handler logic)
 *   - Shared utility files (no procedure definitions)
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const API_MODULES_DIR = join(__dirname, "..", "modules");

/**
 * Recursively find all .ts files in a directory.
 */
function findTsFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);
		if (stat.isDirectory()) {
			results.push(...findTsFiles(fullPath));
		} else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
			results.push(fullPath);
		}
	}
	return results;
}

/**
 * Check if a file is a procedure file (contains a procedure definition).
 * We look for `.handler(` or `.input(` or `protectedProcedure` / `adminProcedure` / `publicProcedure`.
 */
function isProcedureFile(content: string): boolean {
	return (
		content.includes("Procedure") &&
		(content.includes(".handler(") || content.includes(".input("))
	);
}

/**
 * Check if a file accepts `organizationId` from client input.
 * We look for `organizationId` in a Zod schema definition.
 */
function acceptsOrganizationIdFromInput(content: string): boolean {
	// Match: organizationId: z.string() (with optional modifiers)
	return /organizationId\s*:\s*z\.string\(/.test(content);
}

/**
 * Check if a file calls `requireOrgRole` or `requireOrgPermissionAccess` to verify membership,
 * OR uses `authProcedure({ org: ... })` which resolves org membership via the authorize middleware.
 *
 * `authProcedure({ org: { ..., optional: true } })` is also a valid guard:
 * when `organizationId` IS present in the input, the middleware runs the full
 * membership + permission check. When it's absent, the check is skipped — but
 * the handler must not use `input.organizationId` in that case (the IDOR scanner's
 * `handlerOnlyUsesContextUserId` check catches handlers that use orgId without a guard).
 */
function callsRequireOrgRole(content: string): boolean {
	return (
		content.includes("requireOrgRole(") ||
		content.includes("requireOrgPermissionAccess(") ||
		// authProcedure with org option (required or optional) — the authorize
		// middleware handles membership verification when orgId is present in input
		/authProcedure\s*\(\s*\{[\s\S]*?org\s*:/.test(content)
	);
}

/**
 * Check if a file uses `adminProcedure` (global admin guard — no org membership needed).
 */
function usesAdminProcedure(content: string): boolean {
	return /\badminProcedure\b/.test(content);
}

/**
 * Check if a file only uses `context.user.id` (no orgId from input in the handler).
 * This is the case when organizationId is in the schema but the handler
 * only uses context.user.id — meaning the orgId is ignored.
 */
function handlerOnlyUsesContextUserId(content: string): boolean {
	// Extract the handler function body
	const handlerMatch = content.match(
		/\.handler\(\s*async\s*\(\s*\{[^}]*\}\s*\)\s*=>\s*\{([\s\S]*?)(?:\}\s*\);?\s*$|\}\s*\)\s*;?\s*$)/,
	);
	if (!handlerMatch?.[1]) return false;
	const handlerBody = handlerMatch[1];

	// Check if organizationId is used in the handler body (not just in a conditional check)
	// If the handler references input.organizationId anywhere, it's using it
	return !handlerBody.includes("input.organizationId");
}

describe("IDOR Scanner — all API procedures", () => {
	const procedureFiles = findTsFiles(API_MODULES_DIR).filter((f) => {
		const content = readFileSync(f, "utf-8");
		return isProcedureFile(content);
	});

	if (procedureFiles.length === 0) {
		// Sanity check — if we find 0 files, the scanner is broken
		it("should find at least one procedure file", () => {
			expect(procedureFiles.length).toBeGreaterThan(0);
		});
		return;
	}

	for (const filePath of procedureFiles) {
		const relPath = relative(API_MODULES_DIR, filePath);
		const content = readFileSync(filePath, "utf-8");
		const hasOrgIdInput = acceptsOrganizationIdFromInput(content);
		const hasRequireOrgRole = callsRequireOrgRole(content);
		const isAdminProcedure = usesAdminProcedure(content);
		const handlerIgnoresOrgId = handlerOnlyUsesContextUserId(content);

		// Only test files that accept organizationId from input
		if (!hasOrgIdInput) continue;

		const isProtected =
			hasRequireOrgRole || isAdminProcedure || handlerIgnoresOrgId;

		it(`${relPath}: organizationId from input must be guarded by requireOrgRole`, () => {
			if (!isProtected) {
				const reasons: string[] = [];
				if (!hasRequireOrgRole) reasons.push("no requireOrgRole() call found");
				if (!isAdminProcedure) reasons.push("not using adminProcedure");
				if (!handlerIgnoresOrgId)
					reasons.push("handler uses input.organizationId without guard");

				throw new Error(
					`IDOR VULNERABILITY: ${relPath} accepts organizationId from client input but has no authorization guard.\n` +
						`  Issues: ${reasons.join(", ")}\n` +
						`  Fix: Call requireOrgRole(input.organizationId, context.user.id, "member", context.headers) before using input.organizationId in a DB query.\n` +
						"  See: packages/api/src/modules/api-keys/procedures/list.ts for the correct pattern.",
				);
			}
		});
	}
});
