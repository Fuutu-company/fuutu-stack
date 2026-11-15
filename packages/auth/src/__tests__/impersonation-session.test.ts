import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every Better Auth request of an impersonation session — not only the
 * guarded paths — ends once the time limit is over or the impersonating
 * admin lost the permission. A dropped `dont_remember` cookie would
 * otherwise let `/get-session` extend the row to the normal lifetime.
 */

vi.mock("@fuutu/db", () => ({
	getUserAccessState: vi.fn(),
	isUserSessionLive: vi.fn(),
}));

vi.mock("../impersonation-expiry", () => ({
	endExpiredImpersonation: vi.fn(),
	endImpersonation: vi.fn(),
}));

const { getUserAccessState, isUserSessionLive } = await import("@fuutu/db");
const { endExpiredImpersonation, endImpersonation } = await import(
	"../impersonation-expiry"
);
const { authConfig } = await import("../config");
const { hasImpersonatorLostAccess } = await import("../impersonation-access");
const { assertImpersonationActive, isEndedImpersonationResult } = await import(
	"../hooks/impersonation-session"
);

const WINDOW_MS = authConfig.admin.impersonationMinutes * 60_000;
const NOW = new Date();

const IMPERSONATOR = {
	id: "admin-1",
	email: "admin@fuutu.local",
	role: "admin",
	banned: false,
	banExpires: null,
};

function sessionStartedAgo(ms: number, impersonatedBy: string | null) {
	return {
		user: { id: "user-2" },
		session: {
			id: "sess-1",
			userId: "user-2",
			impersonatedBy,
			createdAt: new Date(Date.now() - ms),
		},
	};
}

const lookup = (session: unknown) => vi.fn(async () => session as never);

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getUserAccessState).mockResolvedValue(IMPERSONATOR as never);
	vi.mocked(isUserSessionLive).mockResolvedValue(true);
});

describe("hasImpersonatorLostAccess", () => {
	it("keeps an impersonation while the impersonator may impersonate", async () => {
		await expect(
			hasImpersonatorLostAccess({ impersonatedBy: "admin-1", createdAt: NOW }),
		).resolves.toBe(false);
		expect(getUserAccessState).toHaveBeenCalledWith("admin-1");
	});

	it.each([
		["was demoted", { ...IMPERSONATOR, role: "user" }],
		["is banned", { ...IMPERSONATOR, banned: true }],
		["was deleted", null],
	])("ends it when the impersonator %s", async (_label, impersonator) => {
		vi.mocked(getUserAccessState).mockResolvedValue(impersonator as never);
		await expect(
			hasImpersonatorLostAccess({ impersonatedBy: "admin-1", createdAt: NOW }),
		).resolves.toBe(true);
	});

	it("never reads the database for a user's own session", async () => {
		await expect(
			hasImpersonatorLostAccess({ impersonatedBy: null, createdAt: NOW }),
		).resolves.toBe(false);
		expect(getUserAccessState).not.toHaveBeenCalled();
	});
});

describe("assertImpersonationActive (hooks.before, every path)", () => {
	it("lets a valid impersonation through on an unguarded path", async () => {
		await expect(
			assertImpersonationActive({
				path: "/list-sessions",
				getSession: lookup(sessionStartedAgo(60_000, "admin-1")),
			}),
		).resolves.toBeUndefined();
		expect(endImpersonation).not.toHaveBeenCalled();
	});

	it("ends an expired impersonation and rejects with 401", async () => {
		const expired = sessionStartedAgo(WINDOW_MS + 1, "admin-1");
		await expect(
			assertImpersonationActive({
				path: "/list-sessions",
				getSession: lookup(expired),
			}),
		).rejects.toMatchObject({
			statusCode: 401,
			body: { code: "IMPERSONATION_ENDED" },
		});
		expect(endExpiredImpersonation).toHaveBeenCalledWith(expired.session);
	});

	it("rejects with 401 once the impersonator lost access", async () => {
		vi.mocked(getUserAccessState).mockResolvedValue(null);
		await expect(
			assertImpersonationActive({
				path: "/organization/set-active",
				getSession: lookup(sessionStartedAgo(60_000, "admin-1")),
			}),
		).rejects.toMatchObject({ statusCode: 401 });
		expect(endExpiredImpersonation).not.toHaveBeenCalled();
		expect(endImpersonation).toHaveBeenCalledWith(
			expect.objectContaining({ id: "sess-1", impersonatedBy: "admin-1" }),
			"lost_access",
		);
	});

	it("rejects a cookie-cached impersonation whose session row is gone", async () => {
		vi.mocked(isUserSessionLive).mockResolvedValue(false);
		await expect(
			assertImpersonationActive({
				path: "/list-sessions",
				getSession: lookup(sessionStartedAgo(60_000, "admin-1")),
			}),
		).rejects.toMatchObject({ statusCode: 401 });
		expect(isUserSessionLive).toHaveBeenCalledWith({
			userId: "user-2",
			sessionId: "sess-1",
		});
		expect(endImpersonation).not.toHaveBeenCalled();
	});

	it("keeps /admin/stop-impersonating working while the impersonation is valid", async () => {
		await expect(
			assertImpersonationActive({
				path: "/admin/stop-impersonating",
				getSession: lookup(sessionStartedAgo(60_000, "admin-1")),
			}),
		).resolves.toBeUndefined();
	});

	it("never blocks /sign-out and leaves /get-session to the after hook", async () => {
		for (const path of ["/sign-out", "/get-session"]) {
			const getSession = lookup(sessionStartedAgo(WINDOW_MS + 1, "admin-1"));
			await expect(
				assertImpersonationActive({ path, getSession }),
			).resolves.toBeUndefined();
			expect(getSession).not.toHaveBeenCalled();
		}
	});

	it("costs a user's own session no access read", async () => {
		await assertImpersonationActive({
			path: "/list-sessions",
			getSession: lookup(sessionStartedAgo(10 * WINDOW_MS, null)),
		});
		await assertImpersonationActive({
			path: "/list-sessions",
			getSession: lookup(null),
		});
		expect(getUserAccessState).not.toHaveBeenCalled();
		expect(endExpiredImpersonation).not.toHaveBeenCalled();
	});
});

describe("isEndedImpersonationResult (hooks.after, /get-session)", () => {
	it("is true for an expired impersonation, which it ends", async () => {
		const expired = sessionStartedAgo(WINDOW_MS + 1, "admin-1");
		await expect(
			isEndedImpersonationResult({ path: "/get-session", returned: expired }),
		).resolves.toBe(true);
		expect(endExpiredImpersonation).toHaveBeenCalledWith(expired.session);
	});

	it("is true once the impersonator lost access", async () => {
		vi.mocked(getUserAccessState).mockResolvedValue({
			...IMPERSONATOR,
			role: "user",
		} as never);
		await expect(
			isEndedImpersonationResult({
				path: "/get-session",
				returned: sessionStartedAgo(60_000, "admin-1"),
			}),
		).resolves.toBe(true);
		expect(endImpersonation).toHaveBeenCalledWith(
			expect.objectContaining({ id: "sess-1", impersonatedBy: "admin-1" }),
			"lost_access",
		);
	});

	it("is true for a cookie-cached impersonation whose session row is gone", async () => {
		vi.mocked(isUserSessionLive).mockResolvedValue(false);
		await expect(
			isEndedImpersonationResult({
				path: "/get-session",
				returned: sessionStartedAgo(60_000, "admin-1"),
			}),
		).resolves.toBe(true);
	});

	it("is false for a valid impersonation, a user's own session and no session", async () => {
		for (const returned of [
			sessionStartedAgo(60_000, "admin-1"),
			sessionStartedAgo(10 * WINDOW_MS, null),
			null,
		]) {
			await expect(
				isEndedImpersonationResult({ path: "/get-session", returned }),
			).resolves.toBe(false);
		}
	});

	it("only looks at /get-session", async () => {
		await expect(
			isEndedImpersonationResult({
				path: "/list-sessions",
				returned: sessionStartedAgo(WINDOW_MS + 1, "admin-1"),
			}),
		).resolves.toBe(false);
		expect(endExpiredImpersonation).not.toHaveBeenCalled();
	});
});
