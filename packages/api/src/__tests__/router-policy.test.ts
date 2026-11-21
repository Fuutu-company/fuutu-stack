/**
 * Router policy — walks the built `appRouter` (no source parsing) and
 * checks every procedure's guards against `api-policy.ts`:
 *
 *  - every mutation (any method but GET) is rate-limited;
 *  - mutations under a sensitive prefix (money, credentials, org
 *    structure) reject impersonation sessions and API keys;
 *  - every procedure under a system-admin prefix — reads included — is a
 *    `systemAdminProcedure`;
 *  - every exception names a real procedure and a guard it really lacks.
 *
 * Guards are read from the markers their middlewares carry
 * (`orpc/policy-markers.ts`), so a check inside a handler does not count —
 * use the middleware/option, or list an exception with its reason.
 */
import { isProcedure } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import {
	PROCEDURE_POLICY_EXCEPTIONS,
	type ProcedureGuard,
	SENSITIVE_PROCEDURE_PREFIXES,
	SYSTEM_ADMIN_PROCEDURE_PREFIXES,
} from "../api-policy";
import { type PolicyMarker, readPolicy } from "../orpc/policy-markers";

vi.mock("@fuutu/db", () => ({}));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));
vi.mock("@fuutu/auth", () => ({ auth: { api: {} } }));

const { appRouter } = await import("../orpc/router");

type Leaf = { path: string; method: string; policy: PolicyMarker };

function collectLeaves(node: unknown, path: string[] = []): Leaf[] {
	if (isProcedure(node)) {
		const def = node["~orpc"];
		return [
			{
				path: path.join("."),
				// oRPC's default method is POST.
				method: def.route.method ?? "POST",
				policy: readPolicy(def.middlewares),
			},
		];
	}
	if (!node || typeof node !== "object") return [];
	return Object.entries(node).flatMap(([key, child]) =>
		collectLeaves(child, [...path, key]),
	);
}

const leaves = collectLeaves(appRouter);
const mutations = leaves.filter((leaf) => leaf.method !== "GET");
const isSensitive = (path: string) =>
	SENSITIVE_PROCEDURE_PREFIXES.some((prefix) => path.startsWith(prefix));
const isSystemAdmin = (path: string) =>
	SYSTEM_ADMIN_PROCEDURE_PREFIXES.some((prefix) => path.startsWith(prefix));

const POLICY_FILE = "packages/api/src/app-api-policy.ts";

const FIX: Record<ProcedureGuard, string> = {
	rateLimit:
		'add `.use(createRateLimitMiddleware({ endpoint: "<endpoint>" }))` (orpc/middleware/rate-limit.ts)',
	denyImpersonation:
		"add `denyImpersonation: true` to authProcedure(...) or `.use(denyImpersonation)`",
	sessionOnly:
		"add `sessionOnly: true` to authProcedure(...) or `.use(sessionOnly)`",
	systemAdmin:
		"build it on `systemAdminProcedure(permission)` (orpc/procedures.ts)",
};

function missingGuard(leaf: Leaf, guard: ProcedureGuard): string | null {
	if (leaf.policy[guard]) return null;
	if (PROCEDURE_POLICY_EXCEPTIONS[leaf.path]?.[guard]) return null;
	return `${leaf.path} (${leaf.method}) lacks ${guard}: ${FIX[guard]} — or, if another layer enforces it, list it in appProcedurePolicyExceptions (${POLICY_FILE}) as { "${leaf.path}": { ${guard}: "<reason>" } }.`;
}

describe("router policy (appRouter)", () => {
	it("finds the procedures", () => {
		const paths = leaves.map((leaf) => leaf.path);
		expect(paths).toContain("payments.portal.open");
		expect(paths).toContain("organizations.members.invite");
		expect(mutations.length).toBeGreaterThan(10);
	});

	it("reads the guard markers", () => {
		const portal = leaves.find((leaf) => leaf.path === "payments.portal.open");
		expect(portal?.policy).toEqual({
			rateLimit: true,
			denyImpersonation: true,
			sessionOnly: true,
		});
		const me = leaves.find((leaf) => leaf.path === "users.me");
		expect(me?.policy).toEqual({ desktopAllowed: true });
		const orgs = leaves.find((leaf) => leaf.path === "organizations.list");
		expect(orgs?.policy).toEqual({});
	});

	it("opens the kit's desktop default set to desktop tokens — and nothing session-only", () => {
		const allowed = leaves.filter((leaf) => leaf.policy.desktopAllowed);
		const paths = allowed.map((leaf) => leaf.path);
		for (const path of [
			"desktop.session",
			"desktop.devices.list",
			"users.me",
		]) {
			expect(paths).toContain(path);
		}
		expect(
			leaves
				.filter((leaf) => leaf.policy.desktopAccessFlow)
				.map((leaf) => leaf.path)
				.sort(),
		).toEqual(["desktop.devices.list", "desktop.session"]);
		// A desktop token must never be the way into money, credentials,
		// org structure or admin.
		const contradictions = allowed
			.filter(
				(leaf) =>
					leaf.policy.sessionOnly ||
					leaf.policy.systemAdmin ||
					isSystemAdmin(leaf.path) ||
					isSensitive(leaf.path),
			)
			.map((leaf) => leaf.path);
		expect(contradictions).toEqual([]);
	});

	it("rate-limits every mutation", () => {
		const problems = mutations
			.map((leaf) => missingGuard(leaf, "rateLimit"))
			.filter((problem) => problem !== null);
		expect(problems).toEqual([]);
	});

	it("keeps money, credential and org-structure mutations session-only and free of impersonation", () => {
		const problems = mutations
			.filter((leaf) => isSensitive(leaf.path))
			.flatMap((leaf) => [
				missingGuard(leaf, "denyImpersonation"),
				missingGuard(leaf, "sessionOnly"),
			])
			.filter((problem) => problem !== null);
		expect(problems).toEqual([]);
	});

	it("builds every procedure under a system-admin prefix (reads too) on systemAdminProcedure", () => {
		const admin = leaves.filter((leaf) => isSystemAdmin(leaf.path));
		expect(admin.map((leaf) => leaf.path)).toContain("admin.users.list");
		const problems = admin
			.map((leaf) => missingGuard(leaf, "systemAdmin"))
			.filter((problem) => problem !== null);
		expect(problems).toEqual([]);
	});

	it("marks systemAdminProcedure reads and nothing outside the admin prefixes", () => {
		const list = leaves.find((leaf) => leaf.path === "admin.users.list");
		expect(list?.method).toBe("GET");
		expect(list?.policy.systemAdmin).toBe(true);
		const outside = leaves
			.filter((leaf) => leaf.policy.systemAdmin && !isSystemAdmin(leaf.path))
			.map((leaf) => leaf.path);
		expect(outside).toEqual([]);
	});

	it("lists only exceptions that are still needed", () => {
		const problems: string[] = [];
		for (const [path, guards] of Object.entries(PROCEDURE_POLICY_EXCEPTIONS)) {
			const leaf = leaves.find((candidate) => candidate.path === path);
			if (!leaf) {
				problems.push(
					`${path}: no such procedure in appRouter — remove its policy exception.`,
				);
				continue;
			}
			for (const [guard, reason] of Object.entries(guards)) {
				if (!reason?.trim()) {
					problems.push(`${path}: the ${guard} exception needs a reason.`);
				}
				if (leaf.policy[guard as ProcedureGuard]) {
					problems.push(`${path} already has ${guard} — remove the exception.`);
				}
			}
		}
		expect(problems).toEqual([]);
	});
});
