import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * An impersonation whose admin lost the permission ends for good: its
 * session row is deleted, so restoring the admin's role does not revive
 * it, and only the detector that deleted the row audits.
 */

const store = vi.hoisted(() => ({
	sessions: new Map<string, { id: string; userId: string }>(),
	adminRole: "admin",
}));

vi.mock("@fuutu/db", () => ({
	getUserAccessState: vi.fn(async (id: string) => ({
		id,
		email: "admin@fuutu.local",
		role: store.adminRole,
		banned: false,
		banExpires: null,
	})),
	isUserSessionLive: vi.fn(
		async ({ userId, sessionId }: { userId: string; sessionId: string }) =>
			store.sessions.get(sessionId)?.userId === userId,
	),
	adminRevokeUserSession: vi.fn(
		async ({ userId, sessionId }: { userId: string; sessionId: string }) => {
			const row = store.sessions.get(sessionId);
			if (!row || row.userId !== userId) return 0;
			store.sessions.delete(sessionId);
			return 1;
		},
	),
}));

const audit = vi.hoisted(() => ({ record: vi.fn() }));
vi.mock("@fuutu/logs", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/logs")>()),
	createAuditLogger: () => audit,
}));

const { adminRevokeUserSession } = await import("@fuutu/db");
const { endImpersonationIfAccessLost } = await import(
	"../impersonation-access"
);
const { assertImpersonationActive, isEndedImpersonationResult } = await import(
	"../hooks/impersonation-session"
);

const SESSION = {
	id: "sess-1",
	userId: "user-2",
	impersonatedBy: "admin-1",
	createdAt: new Date(),
};

/** What a request with the session cookie resolves to: the row, if any. */
const lookup = async () =>
	store.sessions.has(SESSION.id) ? { session: SESSION } : null;

beforeEach(() => {
	vi.clearAllMocks();
	store.sessions = new Map([
		[SESSION.id, { id: SESSION.id, userId: SESSION.userId }],
	]);
	store.adminRole = "admin";
});

describe("endImpersonationIfAccessLost", () => {
	it("keeps the session while the admin may impersonate", async () => {
		await expect(endImpersonationIfAccessLost(SESSION)).resolves.toBe(false);
		expect(store.sessions.has(SESSION.id)).toBe(true);
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("deletes that session row of the user and audits the lost access", async () => {
		store.adminRole = "user";
		await expect(endImpersonationIfAccessLost(SESSION)).resolves.toBe(true);
		expect(adminRevokeUserSession).toHaveBeenCalledWith({
			userId: "user-2",
			sessionId: "sess-1",
		});
		expect(audit.record).toHaveBeenCalledOnce();
		expect(audit.record).toHaveBeenCalledWith({
			action: "admin.user.impersonate_ended_lost_access",
			userId: "admin-1",
			organizationId: null,
			metadata: { targetUserId: "user-2" },
		});
	});

	it("counts a deleted row as ended without a second delete or audit", async () => {
		store.sessions.clear();
		await expect(endImpersonationIfAccessLost(SESSION)).resolves.toBe(true);
		expect(adminRevokeUserSession).not.toHaveBeenCalled();
		expect(audit.record).not.toHaveBeenCalled();
	});

	it("never touches a user's own session", async () => {
		store.adminRole = "user";
		await expect(
			endImpersonationIfAccessLost({ ...SESSION, impersonatedBy: null }),
		).resolves.toBe(false);
		expect(adminRevokeUserSession).not.toHaveBeenCalled();
	});
});

describe("lost access through the Better Auth hooks", () => {
	it("restoring the admin role does not revive the session", async () => {
		store.adminRole = "user";
		await expect(
			assertImpersonationActive({
				path: "/list-sessions",
				getSession: lookup,
			}),
		).rejects.toMatchObject({ statusCode: 401 });

		store.adminRole = "admin";
		await expect(lookup()).resolves.toBeNull();
		expect(store.sessions.size).toBe(0);
	});

	it("a role restored within the cookie-cache window does not revive it", async () => {
		// Better Auth answers from the signed session cookie, not the row.
		const cached = async () => ({ session: SESSION });
		store.adminRole = "user";
		await expect(
			assertImpersonationActive({ path: "/list-sessions", getSession: cached }),
		).rejects.toMatchObject({ statusCode: 401 });
		expect(store.sessions.size).toBe(0);

		store.adminRole = "admin";
		await expect(
			assertImpersonationActive({ path: "/list-sessions", getSession: cached }),
		).rejects.toMatchObject({ statusCode: 401 });
		await expect(
			isEndedImpersonationResult({
				path: "/get-session",
				returned: { session: SESSION },
			}),
		).resolves.toBe(true);
		expect(audit.record).toHaveBeenCalledOnce();
	});

	it("a second detector (cookie-cached session) writes no second audit row", async () => {
		store.adminRole = "user";
		await expect(
			assertImpersonationActive({
				path: "/list-sessions",
				getSession: async () => ({ session: SESSION }),
			}),
		).rejects.toMatchObject({ statusCode: 401 });
		await expect(
			isEndedImpersonationResult({
				path: "/get-session",
				returned: { session: SESSION },
			}),
		).resolves.toBe(true);
		expect(adminRevokeUserSession).toHaveBeenCalledOnce();
		expect(audit.record).toHaveBeenCalledOnce();
	});
});
