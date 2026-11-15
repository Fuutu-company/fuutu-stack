import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getSession: vi.fn(),
			getFullOrganization: vi.fn(),
			adminUpdateUser: vi.fn(),
			banUser: vi.fn(),
			unbanUser: vi.fn(),
			setRole: vi.fn(),
			revokeUserSessions: vi.fn(),
			removeUser: vi.fn(),
			requestPasswordReset: vi.fn(),
			impersonateUser: vi.fn(),
			stopImpersonating: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/auth/admin-support", () => ({
	supportCancelUserSubscriptions: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	getUserAccessState: vi.fn(),
	adminListUsers: vi.fn(),
	adminCountUsers: vi.fn(),
	adminGetUserDetail: vi.fn(),
	countAdminUsers: vi.fn(),
	adminSetSystemRole: vi.fn(),
	listSoleOwnedOrganizations: vi.fn(),
	isEmailTaken: vi.fn(),
	adminRevokeUserSession: vi.fn(),
	deleteSessionsImpersonatedBy: vi.fn(),
	adminResetTwoFactor: vi.fn(),
	revokeOAuthTokensForUser: vi.fn(),
	listFilteredAuditLogs: vi.fn(),
	countFilteredAuditLogs: vi.fn(),
}));

const audit = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@fuutu/logs", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/logs")>()),
	createAuditLogger: () => audit,
}));

// Records every rate-limit bucket checked — proves each procedure is wired
// to its endpoint budget.
const rateLimit = vi.hoisted(() => ({ keys: [] as string[] }));
vi.mock("@fuutu/utils/rate-limit", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@fuutu/utils/rate-limit")>();
	return {
		...actual,
		defaultRateLimitStore: {
			async check(key: string, limit: { windowMs: number }) {
				rateLimit.keys.push(key);
				return {
					allowed: true,
					remaining: 1,
					resetAt: Date.now() + limit.windowMs,
				};
			},
		},
	};
});

const { auth } = await import("@fuutu/auth");
const support = await import("@fuutu/auth/admin-support");
const db = await import("@fuutu/db");
const { apiConfig } = await import("../config");
const { adminRouter } = await import("../modules/admin/router");
const { rpcHandler, openApiHandler } = await import("../orpc/handler");

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ADMIN_ID = "admin-1";
const admin = makeUser({
	id: ADMIN_ID,
	email: "admin@fuutu.local",
	role: "admin",
});

const STATES: Record<string, Record<string, unknown>> = {
	[ADMIN_ID]: { email: "admin@fuutu.local", role: "admin" },
	"admin-2": { email: "peer@fuutu.local", role: "admin" },
	"user-2": { email: "ada@fuutu.local", role: "user" },
	"banned-3": {
		email: "banned@fuutu.local",
		role: "user",
		banned: true,
		banExpires: null,
	},
};

function withResHeaders(ctx: Context): Context {
	return { ...ctx, resHeaders: new Headers() };
}

const adminContext = () => withResHeaders(makeSession<Context>(admin));

function impersonatedContext(user = admin): Context {
	const ctx = withResHeaders(makeSession<Context>(user));
	(ctx.session?.session as { impersonatedBy?: string }).impersonatedBy =
		"admin-9";
	return ctx;
}

function apiKeyContext(): Context {
	return {
		session: { user: admin },
		headers: new Headers(),
		apiKey: { id: "key-1", organizationId: null },
		resHeaders: new Headers(),
	} as unknown as Context;
}

const REASON = "Support ticket #4711";

function setCookieHeaders(...cookies: string[]): Headers {
	const headers = new Headers();
	for (const cookie of cookies) headers.append("set-cookie", cookie);
	return headers;
}

beforeEach(() => {
	vi.clearAllMocks();
	rateLimit.keys = [];
	vi.mocked(db.getUserAccessState).mockImplementation(((id: string) => {
		const state = STATES[id];
		return Promise.resolve(
			state ? { id, banned: false, banExpires: null, ...state } : null,
		);
	}) as never);
	vi.mocked(db.adminListUsers).mockResolvedValue([] as never);
	vi.mocked(db.adminCountUsers).mockResolvedValue(0);
	vi.mocked(db.adminGetUserDetail).mockResolvedValue({ id: "user-2" } as never);
	vi.mocked(db.countAdminUsers).mockResolvedValue(2);
	vi.mocked(db.adminSetSystemRole).mockImplementation((async (input: {
		userId: string;
		role: string;
	}) => {
		const current = STATES[input.userId]?.role;
		if (current === undefined) return { status: "not_found" };
		return current === input.role
			? { status: "unchanged" }
			: { status: "updated", previousRole: current };
	}) as never);
	vi.mocked(db.listSoleOwnedOrganizations).mockResolvedValue([]);
	vi.mocked(db.isEmailTaken).mockResolvedValue(false);
	vi.mocked(db.adminRevokeUserSession).mockResolvedValue(1);
	vi.mocked(db.deleteSessionsImpersonatedBy).mockResolvedValue(0);
	vi.mocked(db.adminResetTwoFactor).mockResolvedValue(1);
	vi.mocked(db.revokeOAuthTokensForUser).mockResolvedValue({
		accessTokens: 0,
		refreshTokens: 0,
	});
	vi.mocked(auth.api.impersonateUser).mockResolvedValue({
		headers: setCookieHeaders(
			"better-auth.session_token=imp; Path=/; HttpOnly",
			"better-auth.admin_session=adm; Path=/; HttpOnly",
		),
		response: {
			session: { expiresAt: new Date("2026-06-01T13:00:00Z") },
			user: { id: "user-2" },
		},
	} as never);
	vi.mocked(auth.api.stopImpersonating).mockResolvedValue({
		headers: setCookieHeaders(
			"better-auth.session_token=adm; Path=/; HttpOnly",
			"better-auth.admin_session=; Max-Age=0; Path=/",
		),
		response: {},
	} as never);
});

const users = adminRouter.users;

/**
 * Every system-admin procedure, with an input the admin happy path accepts.
 * `endpoint` is the rate-limit budget it must draw from.
 */
const ADMIN_PROCEDURES = [
	{ name: "list", procedure: users.list, input: {}, endpoint: "adminRead" },
	{
		name: "get",
		procedure: users.get,
		input: { userId: "user-2" },
		endpoint: "adminRead",
	},
	{
		name: "update",
		procedure: users.update,
		input: { userId: "user-2", name: "Ada L." },
		endpoint: "adminMutation",
	},
	{
		name: "ban",
		procedure: users.ban,
		input: { userId: "user-2", reason: REASON },
		endpoint: "adminMutation",
	},
	{
		name: "unban",
		procedure: users.unban,
		input: { userId: "banned-3" },
		endpoint: "adminMutation",
	},
	{
		name: "setRole",
		procedure: users.setRole,
		input: { userId: "user-2", role: "admin", reason: REASON },
		endpoint: "adminMutation",
	},
	{
		name: "revokeSession",
		procedure: users.revokeSession,
		input: { userId: "user-2", sessionId: "sess-9" },
		endpoint: "adminMutation",
	},
	{
		name: "revokeAllSessions",
		procedure: users.revokeAllSessions,
		input: { userId: "user-2" },
		endpoint: "adminMutation",
	},
	{
		name: "sendPasswordReset",
		procedure: users.sendPasswordReset,
		input: { userId: "user-2" },
		endpoint: "adminMutation",
	},
	{
		name: "resetTwoFactor",
		procedure: users.resetTwoFactor,
		input: { userId: "user-2", reason: REASON },
		endpoint: "adminMutation",
	},
	{
		name: "delete",
		procedure: users.delete,
		input: {
			userId: "user-2",
			reason: REASON,
			confirmEmail: "ada@fuutu.local",
		},
		endpoint: "adminMutation",
	},
	{
		name: "impersonate",
		procedure: users.impersonate,
		input: { userId: "user-2", reason: REASON },
		endpoint: "adminMutation",
	},
	{
		name: "auditLogs.list",
		procedure: adminRouter.auditLogs.list,
		input: {},
		endpoint: "adminRead",
	},
] as const;

// ─── Access matrix ──────────────────────────────────────────────────────────

describe.each(ADMIN_PROCEDURES)("admin.users access: $name", (entry) => {
	// `call` is typed per procedure; the table erases that on purpose.
	const run = (context: Context, input: unknown = entry.input) =>
		call(entry.procedure as never, input as never, { context });

	it("rejects unauthenticated callers with 401", async () => {
		await expect(run(makeSession<Context>(null))).rejects.toMatchObject({
			code: "UNAUTHORIZED",
		});
	});

	it("rejects a system role user with 403", async () => {
		await expect(
			run(withResHeaders(makeSession<Context>(makeUser({ id: "user-2" })))),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects an org owner without the system admin role (own org id in input)", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			id: "org-own",
			members: [{ userId: "owner-7", role: "owner" }],
		} as never);
		const owner = makeUser({ id: "owner-7", role: "user" });
		await expect(
			run(withResHeaders(makeSession<Context>(owner)), {
				...entry.input,
				organizationId: "org-own",
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects an admin's API key with 403", async () => {
		await expect(run(apiKeyContext())).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("rejects an impersonation session with 403", async () => {
		await expect(run(impersonatedContext())).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
	});

	it("serves a system admin and draws from its rate-limit budget", async () => {
		await expect(run(adminContext())).resolves.toBeDefined();
		expect(rateLimit.keys).toContain(`${entry.endpoint}:${ADMIN_ID}`);
	});
});

describe("admin rate-limit budgets", () => {
	it("allows 120 reads and 30 mutations per admin and minute", () => {
		expect(apiConfig.rateLimit.endpoints.adminRead).toEqual({
			maxRequests: 120,
			windowMs: 60_000,
		});
		expect(apiConfig.rateLimit.endpoints.adminMutation).toEqual({
			maxRequests: 30,
			windowMs: 60_000,
		});
	});
});

// ─── Reads ──────────────────────────────────────────────────────────────────

describe("admin.users.list", () => {
	it("passes search, filters, sort and pagination to the query", async () => {
		vi.mocked(db.adminListUsers).mockResolvedValue([{ id: "user-2" }] as never);
		vi.mocked(db.adminCountUsers).mockResolvedValue(51);
		const result = await call(
			users.list,
			{
				q: "ada",
				role: "user",
				banned: false,
				emailVerified: true,
				sort: "email",
				dir: "asc",
				page: 2,
				pageSize: 25,
			},
			{ context: adminContext() },
		);
		const filters = {
			q: "ada",
			role: "user",
			banned: false,
			emailVerified: true,
		};
		expect(db.adminListUsers).toHaveBeenCalledWith({
			...filters,
			sort: "email",
			dir: "asc",
			page: 2,
			pageSize: 25,
		});
		expect(db.adminCountUsers).toHaveBeenCalledWith(filters);
		expect(result).toEqual({
			items: [{ id: "user-2" }],
			page: 2,
			pageSize: 25,
			total: 51,
			totalPages: 3,
		});
	});

	it("accepts query-string booleans (OpenAPI GET)", async () => {
		await call(
			users.list,
			{ banned: "true", emailVerified: "false" },
			{ context: adminContext() },
		);
		expect(db.adminCountUsers).toHaveBeenCalledWith(
			expect.objectContaining({ banned: true, emailVerified: false }),
		);
	});

	it("caps the page size at 100", async () => {
		await expect(
			call(users.list, { pageSize: 101 }, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("caps the page number at 100 000 (no unbounded OFFSET)", async () => {
		await expect(
			call(users.list, { page: 100_000 }, { context: adminContext() }),
		).resolves.toBeDefined();
		await expect(
			call(users.list, { page: 100_001 }, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(db.adminListUsers).toHaveBeenCalledTimes(1);
	});
});

describe("admin.users.get", () => {
	it("returns 404 for an unknown user", async () => {
		vi.mocked(db.adminGetUserDetail).mockResolvedValue(null);
		await expect(
			call(users.get, { userId: "nobody" }, { context: adminContext() }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("admin.auditLogs.list paging", () => {
	it("caps the page number at 100 000", async () => {
		vi.mocked(db.listFilteredAuditLogs).mockResolvedValue([] as never);
		vi.mocked(db.countFilteredAuditLogs).mockResolvedValue(0);
		await expect(
			call(
				adminRouter.auditLogs.list,
				{ page: 100_001 },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(db.listFilteredAuditLogs).not.toHaveBeenCalled();
	});
});

describe("admin.auditLogs.list filters", () => {
	it("passes the timeline and target filters to the queries", async () => {
		vi.mocked(db.listFilteredAuditLogs).mockResolvedValue([] as never);
		vi.mocked(db.countFilteredAuditLogs).mockResolvedValue(0);
		await call(
			adminRouter.auditLogs.list,
			{
				timelineUserId: "user-2",
				actorUserId: ADMIN_ID,
				targetOrganizationId: "org-1",
				actionPrefix: "admin.",
				from: "2026-01-01T00:00:00Z",
				to: "2026-02-01T00:00:00Z",
			},
			{ context: adminContext() },
		);
		const filters = {
			timelineUserId: "user-2",
			actorUserId: ADMIN_ID,
			targetOrganizationId: "org-1",
			actionPrefix: "admin.",
			from: new Date("2026-01-01T00:00:00Z"),
			to: new Date("2026-02-01T00:00:00Z"),
		};
		expect(db.listFilteredAuditLogs).toHaveBeenCalledWith(
			expect.objectContaining({ ...filters, take: 50, skip: 0 }),
		);
		expect(db.countFilteredAuditLogs).toHaveBeenCalledWith(
			expect.objectContaining(filters),
		);
	});
});

// ─── Audit shape ────────────────────────────────────────────────────────────

function auditedActions(): string[] {
	return audit.record.mock.calls.map(([event]) => event.action);
}

/** The audit row was written before `action` first ran. */
function expectAuditedBefore(action: {
	mock: { invocationCallOrder: number[] };
}) {
	const auditedAt = audit.record.mock.invocationCallOrder[0];
	const ranAt = action.mock.invocationCallOrder[0];
	expect(auditedAt).toBeDefined();
	expect(ranAt).toBeDefined();
	expect(auditedAt ?? 0).toBeLessThan(ranAt ?? 0);
}

function lastAudit() {
	return audit.record.mock.calls.at(-1)?.[0];
}

function expectAudit(
	action: string,
	metadata: Record<string, unknown>,
	actor = ADMIN_ID,
) {
	const event = lastAudit();
	expect(event).toMatchObject({
		action,
		userId: actor,
		organizationId: null,
		metadata,
	});
	// Ids only — the audit log outlives the user row.
	expect(JSON.stringify(event?.metadata)).not.toContain("@");
}

// ─── update ─────────────────────────────────────────────────────────────────

describe("admin.users.update", () => {
	it("updates name and verification and audits the field names", async () => {
		await call(
			users.update,
			{ userId: "user-2", name: "Ada L.", emailVerified: true },
			{ context: adminContext() },
		);
		expect(auth.api.adminUpdateUser).toHaveBeenCalledWith({
			body: { userId: "user-2", data: { name: "Ada L.", emailVerified: true } },
			headers: expect.any(Headers),
		});
		expect(auth.api.revokeUserSessions).not.toHaveBeenCalled();
		expectAudit("admin.user.update", {
			targetUserId: "user-2",
			changedFields: ["name", "emailVerified"],
		});
	});

	it("changes the email: unverifies it and signs the user out everywhere", async () => {
		await call(
			users.update,
			{ userId: "user-2", email: "Ada.New@Fuutu.local", reason: REASON },
			{ context: adminContext() },
		);
		expect(db.isEmailTaken).toHaveBeenCalledWith(
			"ada.new@fuutu.local",
			"user-2",
		);
		expect(auth.api.adminUpdateUser).toHaveBeenCalledWith({
			body: {
				userId: "user-2",
				data: { email: "ada.new@fuutu.local", emailVerified: false },
			},
			headers: expect.any(Headers),
		});
		expect(auth.api.revokeUserSessions).toHaveBeenCalledWith({
			body: { userId: "user-2" },
			headers: expect.any(Headers),
		});
		expect(db.revokeOAuthTokensForUser).toHaveBeenCalledWith("user-2");
		expectAudit("admin.user.update", {
			targetUserId: "user-2",
			reason: REASON,
			changedFields: ["email", "emailVerified"],
		});
	});

	it("requires a reason for an email change", async () => {
		await expect(
			call(
				users.update,
				{ userId: "user-2", email: "new@fuutu.local" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(auth.api.adminUpdateUser).not.toHaveBeenCalled();
	});

	it("rejects marking a new email as verified in the same change", async () => {
		await expect(
			call(
				users.update,
				{
					userId: "user-2",
					email: "new@fuutu.local",
					emailVerified: true,
					reason: REASON,
				},
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("refuses an email already used by another account", async () => {
		vi.mocked(db.isEmailTaken).mockResolvedValue(true);
		await expect(
			call(
				users.update,
				{ userId: "user-2", email: "taken@fuutu.local", reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(auth.api.adminUpdateUser).not.toHaveBeenCalled();
	});

	it.each([
		["own", ADMIN_ID],
		["another admin's", "admin-2"],
	])("refuses to change %s email", async (_label, userId) => {
		await expect(
			call(
				users.update,
				{ userId, email: "takeover@fuutu.local", reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.adminUpdateUser).not.toHaveBeenCalled();
	});

	it("rejects an empty update", async () => {
		await expect(
			call(users.update, { userId: "user-2" }, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("returns 404 for an unknown user", async () => {
		await expect(
			call(
				users.update,
				{ userId: "nobody", name: "X" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

// ─── ban / unban ────────────────────────────────────────────────────────────

describe("admin.users.ban", () => {
	it("bans with the reason, revokes OAuth tokens and audits", async () => {
		await call(
			users.ban,
			{ userId: "user-2", reason: REASON },
			{ context: adminContext() },
		);
		expect(auth.api.banUser).toHaveBeenCalledWith({
			body: { userId: "user-2", banReason: REASON },
			headers: expect.any(Headers),
		});
		expect(db.revokeOAuthTokensForUser).toHaveBeenCalledWith("user-2");
		expectAudit("admin.user.ban", { targetUserId: "user-2", reason: REASON });
	});

	it("writes the audit row before the ban", async () => {
		await call(
			users.ban,
			{ userId: "user-2", reason: REASON },
			{ context: adminContext() },
		);
		expect(auditedActions()).toEqual(["admin.user.ban"]);
		expectAuditedBefore(vi.mocked(auth.api.banUser));
	});

	it("turns an expiry date into Better Auth's banExpiresIn seconds", async () => {
		vi.useFakeTimers({ now: new Date("2026-06-01T12:00:00Z") });
		try {
			await call(
				users.ban,
				{
					userId: "user-2",
					reason: REASON,
					expiresAt: "2026-06-02T12:00:00Z",
				},
				{ context: adminContext() },
			);
		} finally {
			vi.useRealTimers();
		}
		expect(auth.api.banUser).toHaveBeenCalledWith(
			expect.objectContaining({
				body: { userId: "user-2", banReason: REASON, banExpiresIn: 86_400 },
			}),
		);
	});

	it("rejects an expiry in the past", async () => {
		await expect(
			call(
				users.ban,
				{ userId: "user-2", reason: REASON, expiresAt: "2000-01-01T00:00:00Z" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it.each(["", "ok", "x".repeat(501)])(
		"requires a reason of 3-500 characters (%#)",
		async (reason) => {
			await expect(
				call(
					users.ban,
					{ userId: "user-2", reason },
					{ context: adminContext() },
				),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
			expect(auth.api.banUser).not.toHaveBeenCalled();
		},
	);

	it("refuses to ban yourself", async () => {
		await expect(
			call(
				users.ban,
				{ userId: ADMIN_ID, reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.banUser).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("refuses to ban another admin (demote first)", async () => {
		await expect(
			call(
				users.ban,
				{ userId: "admin-2", reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.banUser).not.toHaveBeenCalled();
	});

	it("maps Better Auth errors to typed oRPC errors", async () => {
		vi.mocked(auth.api.banUser).mockRejectedValue(
			Object.assign(new Error("User not found"), {
				name: "APIError",
				statusCode: 404,
			}),
		);
		await expect(
			call(
				users.ban,
				{ userId: "user-2", reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		// Audited before the call; the failed row says no ban came of it.
		expect(auditedActions()).toEqual([
			"admin.user.ban",
			"admin.user.ban_failed",
		]);
		expectAudit("admin.user.ban_failed", {
			targetUserId: "user-2",
			reason: REASON,
		});
		expect(db.revokeOAuthTokensForUser).not.toHaveBeenCalled();
	});
});

describe("admin.users.unban", () => {
	it("lifts the ban and audits", async () => {
		await call(
			users.unban,
			{ userId: "banned-3" },
			{ context: adminContext() },
		);
		expect(auth.api.unbanUser).toHaveBeenCalledWith({
			body: { userId: "banned-3" },
			headers: expect.any(Headers),
		});
		expectAudit("admin.user.unban", { targetUserId: "banned-3" });
	});
});

// ─── setRole ────────────────────────────────────────────────────────────────

describe("admin.users.setRole", () => {
	it("promotes a user and audits the change", async () => {
		await call(
			users.setRole,
			{ userId: "user-2", role: "admin", reason: REASON },
			{ context: adminContext() },
		);
		expect(db.adminSetSystemRole).toHaveBeenCalledWith({
			userId: "user-2",
			role: "admin",
		});
		expect(auth.api.revokeUserSessions).not.toHaveBeenCalled();
		expect(db.deleteSessionsImpersonatedBy).not.toHaveBeenCalled();
		expectAudit("admin.user.set_role", {
			targetUserId: "user-2",
			reason: REASON,
			changedFields: ["role"],
		});
	});

	it("writes the audit row before the role changes", async () => {
		await call(
			users.setRole,
			{ userId: "admin-2", role: "user", reason: REASON },
			{ context: adminContext() },
		);
		expect(auditedActions()).toEqual(["admin.user.set_role"]);
		expectAuditedBefore(vi.mocked(db.adminSetSystemRole));
	});

	it("records set_role_failed when the role write fails", async () => {
		vi.mocked(db.adminSetSystemRole).mockRejectedValueOnce(
			new Error("serialization failure"),
		);
		await expect(
			call(
				users.setRole,
				{ userId: "user-2", role: "admin", reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toThrow();
		expect(auditedActions()).toEqual([
			"admin.user.set_role",
			"admin.user.set_role_failed",
		]);
		expectAudit("admin.user.set_role_failed", {
			targetUserId: "user-2",
			reason: REASON,
			changedFields: ["role"],
		});
	});

	it("demotes another admin and ends their sessions", async () => {
		await call(
			users.setRole,
			{ userId: "admin-2", role: "user", reason: REASON },
			{ context: adminContext() },
		);
		expect(db.adminSetSystemRole).toHaveBeenCalledWith({
			userId: "admin-2",
			role: "user",
		});
		expect(auth.api.revokeUserSessions).toHaveBeenCalledWith({
			body: { userId: "admin-2" },
			headers: expect.any(Headers),
		});
	});

	it("ends the impersonations the demoted admin is running", async () => {
		await call(
			users.setRole,
			{ userId: "admin-2", role: "user", reason: REASON },
			{ context: adminContext() },
		);
		expect(db.deleteSessionsImpersonatedBy).toHaveBeenCalledWith("admin-2");
	});

	it("never demotes the last admin (checked inside the role transaction)", async () => {
		vi.mocked(db.adminSetSystemRole).mockResolvedValueOnce({
			status: "last_admin",
		});
		await expect(
			call(
				users.setRole,
				{ userId: "admin-2", role: "user", reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "CONFLICT" });
		expect(auth.api.setRole).not.toHaveBeenCalled();
		expect(auth.api.revokeUserSessions).not.toHaveBeenCalled();
		expect(auditedActions()).toEqual([
			"admin.user.set_role",
			"admin.user.set_role_failed",
		]);
	});

	it("refuses to change your own role", async () => {
		await expect(
			call(
				users.setRole,
				{ userId: ADMIN_ID, role: "user", reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(db.adminSetSystemRole).not.toHaveBeenCalled();
	});

	it("requires a reason", async () => {
		await expect(
			call(users.setRole, { userId: "user-2", role: "admin" } as never, {
				context: adminContext(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("only accepts the system roles", async () => {
		await expect(
			call(
				users.setRole,
				{ userId: "user-2", role: "owner", reason: REASON } as never,
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("is a no-op when the role does not change", async () => {
		await call(
			users.setRole,
			{ userId: "user-2", role: "user", reason: REASON },
			{ context: adminContext() },
		);
		expect(auth.api.setRole).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("still audits a change the pre-read missed (role changed in between)", async () => {
		vi.mocked(db.adminSetSystemRole).mockResolvedValueOnce({
			status: "updated",
			previousRole: "admin",
		});
		const result = await call(
			users.setRole,
			{ userId: "user-2", role: "user", reason: REASON },
			{ context: adminContext() },
		);
		expect(result).toEqual({ success: true, changed: true });
		expect(auditedActions()).toEqual(["admin.user.set_role"]);
	});

	it("writes no audit row for an unchanged promotion either", async () => {
		await call(
			users.setRole,
			{ userId: "admin-2", role: "admin", reason: REASON },
			{ context: adminContext() },
		);
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("a demotion that finds the role already user still ends sessions and impersonations", async () => {
		// A retry after the first attempt's revoke failed must complete it.
		const result = await call(
			users.setRole,
			{ userId: "user-2", role: "user", reason: REASON },
			{ context: adminContext() },
		);
		expect(result).toEqual({ success: true, changed: false });
		expect(auth.api.revokeUserSessions).toHaveBeenCalledWith({
			body: { userId: "user-2" },
			headers: expect.any(Headers),
		});
		expect(db.deleteSessionsImpersonatedBy).toHaveBeenCalledWith("user-2");
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("an unchanged promotion revokes nothing", async () => {
		await call(
			users.setRole,
			{ userId: "admin-2", role: "admin", reason: REASON },
			{ context: adminContext() },
		);
		expect(auth.api.revokeUserSessions).not.toHaveBeenCalled();
		expect(db.deleteSessionsImpersonatedBy).not.toHaveBeenCalled();
	});
});

// ─── sessions ───────────────────────────────────────────────────────────────

describe("admin.users.revokeSession", () => {
	it("revokes the session by id, scoped to the user, and audits", async () => {
		await call(
			users.revokeSession,
			{ userId: "user-2", sessionId: "sess-9" },
			{ context: adminContext() },
		);
		expect(db.adminRevokeUserSession).toHaveBeenCalledWith({
			userId: "user-2",
			sessionId: "sess-9",
		});
		expectAudit("admin.user.session_revoke", { targetUserId: "user-2" });
	});

	it("returns 404 when the session is not the user's", async () => {
		vi.mocked(db.adminRevokeUserSession).mockResolvedValue(0);
		await expect(
			call(
				users.revokeSession,
				{ userId: "user-2", sessionId: "someone-elses" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(audit.record).not.toHaveBeenCalled();
	});
});

describe("admin.users.revokeAllSessions", () => {
	it("ends every session and OAuth grant of the user", async () => {
		await call(
			users.revokeAllSessions,
			{ userId: "user-2", reason: REASON },
			{ context: adminContext() },
		);
		expect(auth.api.revokeUserSessions).toHaveBeenCalledWith({
			body: { userId: "user-2" },
			headers: expect.any(Headers),
		});
		expect(db.revokeOAuthTokensForUser).toHaveBeenCalledWith("user-2");
		expect(db.deleteSessionsImpersonatedBy).toHaveBeenCalledWith("user-2");
		expectAudit("admin.user.sessions_revoke_all", {
			targetUserId: "user-2",
			reason: REASON,
		});
	});
});

// ─── password reset / 2FA ───────────────────────────────────────────────────

describe("admin.users.sendPasswordReset", () => {
	it("sends Better Auth's reset email to the user's address", async () => {
		await call(
			users.sendPasswordReset,
			{ userId: "user-2" },
			{ context: adminContext() },
		);
		expect(auth.api.requestPasswordReset).toHaveBeenCalledWith({
			body: {
				email: "ada@fuutu.local",
				redirectTo: expect.stringMatching(/\/auth\/reset-password$/),
			},
		});
		expectAudit("admin.user.password_reset_send", { targetUserId: "user-2" });
	});
});

describe("admin.users.resetTwoFactor", () => {
	it("removes 2FA, signs the user out and audits", async () => {
		await call(
			users.resetTwoFactor,
			{ userId: "user-2", reason: REASON },
			{ context: adminContext() },
		);
		expect(db.adminResetTwoFactor).toHaveBeenCalledWith("user-2");
		expect(auth.api.revokeUserSessions).toHaveBeenCalledWith({
			body: { userId: "user-2" },
			headers: expect.any(Headers),
		});
		expectAudit("admin.user.two_factor_reset", {
			targetUserId: "user-2",
			reason: REASON,
		});
	});

	it.each([ADMIN_ID, "admin-2"])("refuses for admin %s", async (userId) => {
		await expect(
			call(
				users.resetTwoFactor,
				{ userId, reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(db.adminResetTwoFactor).not.toHaveBeenCalled();
	});

	it("requires a reason", async () => {
		await expect(
			call(users.resetTwoFactor, { userId: "user-2" } as never, {
				context: adminContext(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

// ─── delete ─────────────────────────────────────────────────────────────────

describe("admin.users.delete", () => {
	const input = {
		userId: "user-2",
		reason: REASON,
		confirmEmail: " ADA@fuutu.local ",
	};

	it("deletes after the typed confirmation and audits", async () => {
		await call(users.delete, input, { context: adminContext() });
		expect(auth.api.removeUser).toHaveBeenCalledWith({
			body: { userId: "user-2" },
			headers: expect.any(Headers),
		});
		expectAudit("admin.user.delete", {
			targetUserId: "user-2",
			reason: REASON,
		});
	});

	it("writes the audit row before cancelling or deleting anything", async () => {
		await call(users.delete, input, { context: adminContext() });
		expect(auditedActions()).toEqual(["admin.user.delete"]);
		expectAuditedBefore(vi.mocked(support.supportCancelUserSubscriptions));
		expectAuditedBefore(vi.mocked(auth.api.removeUser));
	});

	it("records delete_failed when Better Auth cannot remove the user", async () => {
		vi.mocked(auth.api.removeUser).mockRejectedValueOnce(
			new Error("database down"),
		);
		await expect(
			call(users.delete, input, { context: adminContext() }),
		).rejects.toThrow();
		expect(auditedActions()).toEqual([
			"admin.user.delete",
			"admin.user.delete_failed",
		]);
		expectAudit("admin.user.delete_failed", {
			targetUserId: "user-2",
			reason: REASON,
		});
	});

	it("cancels the user's subscriptions strictly before deleting", async () => {
		const order: string[] = [];
		vi.mocked(support.supportCancelUserSubscriptions).mockImplementationOnce(
			async () => {
				order.push("cancel");
			},
		);
		vi.mocked(auth.api.removeUser).mockImplementationOnce((async () => {
			order.push("remove");
			return { success: true };
		}) as never);
		await call(users.delete, input, { context: adminContext() });
		expect(support.supportCancelUserSubscriptions).toHaveBeenCalledWith(
			"user-2",
		);
		expect(order).toEqual(["cancel", "remove"]);
	});

	it("aborts with 502 when a subscription could not be cancelled", async () => {
		vi.mocked(support.supportCancelUserSubscriptions).mockRejectedValueOnce(
			Object.assign(new Error("Subscriptions could not be cancelled"), {
				name: "SubscriptionCancellationError",
			}),
		);
		await expect(
			call(users.delete, input, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_GATEWAY", status: 502 });
		expect(auth.api.removeUser).not.toHaveBeenCalled();
		expect(auditedActions()).toEqual([
			"admin.user.delete",
			"admin.user.delete_failed",
		]);
	});

	it("refuses when the confirmation is not the user's email", async () => {
		await expect(
			call(
				users.delete,
				{ ...input, confirmEmail: "someone@fuutu.local" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(auth.api.removeUser).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("refuses while the user is the sole owner of an organization", async () => {
		vi.mocked(db.listSoleOwnedOrganizations).mockResolvedValue([
			{ id: "org-1", name: "Acme", slug: "acme" },
		]);
		await expect(
			call(users.delete, input, { context: adminContext() }),
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { organizations: [{ id: "org-1", slug: "acme" }] },
		});
		expect(auth.api.removeUser).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("refuses to delete yourself", async () => {
		await expect(
			call(
				users.delete,
				{ ...input, userId: ADMIN_ID, confirmEmail: "admin@fuutu.local" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("refuses to delete another admin (demote first)", async () => {
		await expect(
			call(
				users.delete,
				{ ...input, userId: "admin-2", confirmEmail: "peer@fuutu.local" },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.removeUser).not.toHaveBeenCalled();
	});

	it("requires a reason", async () => {
		await expect(
			call(
				users.delete,
				{ userId: "user-2", confirmEmail: "ada@fuutu.local" } as never,
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

// ─── impersonation ──────────────────────────────────────────────────────────

describe("admin.users.impersonate", () => {
	it("starts the session, forwards every Set-Cookie and audits", async () => {
		const context = adminContext();
		const result = await call(
			users.impersonate,
			{ userId: "user-2", reason: REASON },
			{ context },
		);
		expect(auth.api.impersonateUser).toHaveBeenCalledWith({
			body: { userId: "user-2" },
			headers: expect.any(Headers),
			returnHeaders: true,
		});
		expect(context.resHeaders?.getSetCookie()).toEqual([
			"better-auth.session_token=imp; Path=/; HttpOnly",
			"better-auth.admin_session=adm; Path=/; HttpOnly",
		]);
		expect(result).toEqual({
			success: true,
			expiresAt: new Date("2026-06-01T13:00:00Z"),
		});
		expectAudit("admin.user.impersonate_start", {
			targetUserId: "user-2",
			reason: REASON,
		});
	});

	it.each([
		["yourself", ADMIN_ID],
		["another admin", "admin-2"],
		["a banned user", "banned-3"],
	])("never impersonates %s", async (_label, userId) => {
		await expect(
			call(
				users.impersonate,
				{ userId, reason: REASON },
				{ context: adminContext() },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(auth.api.impersonateUser).not.toHaveBeenCalled();
	});

	it("creates no session when the audit row cannot be written", async () => {
		audit.record.mockRejectedValueOnce(new Error("audit sink down"));
		const context = adminContext();
		await expect(
			call(
				users.impersonate,
				{ userId: "user-2", reason: REASON },
				{ context },
			),
		).rejects.toThrow("audit sink down");
		expect(auth.api.impersonateUser).not.toHaveBeenCalled();
		expect(context.resHeaders?.getSetCookie()).toEqual([]);
	});

	it("records impersonate_failed when Better Auth refuses the session", async () => {
		vi.mocked(auth.api.impersonateUser).mockRejectedValueOnce(
			new Error("session store down"),
		);
		const context = adminContext();
		await expect(
			call(
				users.impersonate,
				{ userId: "user-2", reason: REASON },
				{ context },
			),
		).rejects.toThrow();
		expect(audit.record.mock.calls.map(([event]) => event.action)).toEqual([
			"admin.user.impersonate_start",
			"admin.user.impersonate_failed",
		]);
		expectAudit("admin.user.impersonate_failed", {
			targetUserId: "user-2",
			reason: REASON,
		});
		expect(context.resHeaders?.getSetCookie()).toEqual([]);
	});

	it("requires a reason", async () => {
		await expect(
			call(users.impersonate, { userId: "user-2" } as never, {
				context: adminContext(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("fails before creating a session when cookies cannot be returned", async () => {
		await expect(
			call(
				users.impersonate,
				{ userId: "user-2", reason: REASON },
				{ context: makeSession<Context>(admin) },
			),
		).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
		expect(auth.api.impersonateUser).not.toHaveBeenCalled();
	});
});

describe("admin.impersonation.stop", () => {
	const stop = adminRouter.impersonation.stop;

	it("restores the admin session, forwards cookies and audits the admin as actor", async () => {
		const context = impersonatedContext(makeUser({ id: "user-2" }));
		await call(stop, undefined, { context });
		expect(auth.api.stopImpersonating).toHaveBeenCalledWith({
			headers: expect.any(Headers),
			returnHeaders: true,
		});
		expect(context.resHeaders?.getSetCookie()).toEqual([
			"better-auth.session_token=adm; Path=/; HttpOnly",
			"better-auth.admin_session=; Max-Age=0; Path=/",
		]);
		expectAudit(
			"admin.user.impersonate_stop",
			{ targetUserId: "user-2" },
			"admin-9",
		);
		expect(rateLimit.keys).toContain("adminMutation:user-2");
	});

	it("rejects a session that is not impersonating", async () => {
		await expect(
			call(stop, undefined, { context: adminContext() }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(auth.api.stopImpersonating).not.toHaveBeenCalled();
	});

	it("rejects unauthenticated callers and API keys", async () => {
		await expect(
			call(stop, undefined, { context: makeSession<Context>(null) }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		await expect(
			call(stop, undefined, { context: apiKeyContext() }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("Set-Cookie on the wire (ResponseHeadersPlugin)", () => {
	const wireContext = () => ({
		session: makeSession<Context>(admin).session,
		headers: new Headers(),
		apiKey: null,
	});

	it("RPC handler returns the impersonation cookies", async () => {
		const { response } = await rpcHandler.handle(
			new Request("http://localhost/api/rpc/admin/users/impersonate", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ json: { userId: "user-2", reason: REASON } }),
			}),
			{ prefix: "/api/rpc", context: wireContext() },
		);
		expect(response?.status).toBe(200);
		expect(response?.headers.getSetCookie()).toEqual([
			"better-auth.session_token=imp; Path=/; HttpOnly",
			"better-auth.admin_session=adm; Path=/; HttpOnly",
		]);
	});

	it("OpenAPI handler returns the impersonation cookies", async () => {
		const { response } = await openApiHandler.handle(
			new Request("http://localhost/api/admin/users/user-2/impersonate", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ reason: REASON }),
			}),
			{ prefix: "/api", context: wireContext() },
		);
		expect(response?.status).toBe(200);
		expect(response?.headers.getSetCookie()).toHaveLength(2);
	});
});
