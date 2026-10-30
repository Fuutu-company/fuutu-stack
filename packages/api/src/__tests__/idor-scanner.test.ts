/**
 * IDOR (Insecure Direct Object Reference) Scanner Test
 *
 * Statically scans ALL API procedure files for a critical pattern:
 *   1. Procedure accepts `organizationId` from client input (Zod schema)
 *   2. Procedure does NOT call `requireOrgPermissionAccess(...)` (or use
 *      `authProcedure({ org: ... })`) before using it
 *
 * This is a static source-code scan — no DB, no runtime, no mocks.
 * It catches the class of bug where a client-supplied organizationId
 * is passed directly to a DB query without membership verification.
 *
 * The test FAILS if any procedure file:
 *   - Has `organizationId` in a Zod input schema AND
 *   - Does NOT contain a `requireOrgPermissionAccess(` call or an
 *     `authProcedure({ org: ... })` guard
 *
 * Exceptions (legitimate cases that don't need requireOrgPermissionAccess):
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
	// Match: organizationId: z.<anything> — string, uuid, coerce, etc.
	return /organizationId\s*:\s*z\./.test(content);
}

/**
 * Check if a file calls `requireOrgPermissionAccess` to verify membership,
 * OR uses `authProcedure({ org: ... })` which resolves org membership via the authorize middleware.
 *
 * `authProcedure({ org: { ..., optional: true } })` is also a valid guard:
 * when `organizationId` IS present in the input, the middleware runs the full
 * membership + permission check. When it's absent, the check is skipped — but
 * the handler must not use `input.organizationId` in that case (the IDOR scanner's
 * `handlerOnlyUsesContextUserId` check catches handlers that use orgId without a guard).
 */
function callsRequireOrgPermissionAccess(content: string): boolean {
	return (
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
	// Everything after `.handler(` is the handler body — a substring scan
	// catches `input.organizationId` even inside nested destructures that a
	// `[^}]*` regex would miss.
	const idx = content.indexOf(".handler(");
	if (idx === -1) return false;
	const handlerBody = content.slice(idx);
	if (handlerBody.includes("input.organizationId")) return false;
	// `const { organizationId } = input` (also with renames or extra keys)
	// is a use too — the substring check above cannot see it.
	return !/\{[^}]*\borganizationId\b[^}]*\}\s*=\s*input\b/.test(handlerBody);
}

describe("handlerOnlyUsesContextUserId detection", () => {
	const wrap = (handlerBody: string) =>
		`export const proc = protectedProcedure.input(z.object({ organizationId: z.string() })).handler(async ({ input, context }) => { ${handlerBody} });`;

	it("detects direct input.organizationId usage", () => {
		expect(
			handlerOnlyUsesContextUserId(wrap("return input.organizationId;")),
		).toBe(false);
	});

	it("detects destructured organizationId from input", () => {
		expect(
			handlerOnlyUsesContextUserId(
				wrap(
					"const { id, organizationId, ...data } = input; return organizationId;",
				),
			),
		).toBe(false);
	});

	it("detects renamed destructure of organizationId", () => {
		expect(
			handlerOnlyUsesContextUserId(
				wrap("const { organizationId: orgId } = input; return orgId;"),
			),
		).toBe(false);
	});

	it("returns true when the handler ignores orgId", () => {
		expect(handlerOnlyUsesContextUserId(wrap("return context.user.id;"))).toBe(
			true,
		);
	});

	it("returns true when destructuring omits organizationId", () => {
		expect(
			handlerOnlyUsesContextUserId(wrap("const { id } = input; return id;")),
		).toBe(true);
	});
});

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
		const hasOrgAccessGuard = callsRequireOrgPermissionAccess(content);
		const isAdminProcedure = usesAdminProcedure(content);
		const handlerIgnoresOrgId = handlerOnlyUsesContextUserId(content);

		// Only test files that accept organizationId from input
		if (!hasOrgIdInput) continue;

		const isProtected =
			hasOrgAccessGuard || isAdminProcedure || handlerIgnoresOrgId;

		it(`${relPath}: organizationId from input must be guarded by requireOrgPermissionAccess or authProcedure({ org })`, () => {
			if (!isProtected) {
				const reasons: string[] = [];
				if (!hasOrgAccessGuard)
					reasons.push(
						"no requireOrgPermissionAccess() call or authProcedure({ org }) guard found",
					);
				if (!isAdminProcedure) reasons.push("not using adminProcedure");
				if (!handlerIgnoresOrgId)
					reasons.push("handler uses input.organizationId without guard");

				throw new Error(
					`IDOR VULNERABILITY: ${relPath} accepts organizationId from client input but has no authorization guard.\n` +
						`  Issues: ${reasons.join(", ")}\n` +
						"  Fix: Call requireOrgPermissionAccess(input.organizationId, context.user.id, PERMISSIONS.X.Y, context) or declare authProcedure({ org: ... }) before using input.organizationId in a DB query.\n" +
						"  See: packages/api/src/modules/api-keys/procedures/list.ts for the correct pattern.",
				);
			}
		});
	}
});
