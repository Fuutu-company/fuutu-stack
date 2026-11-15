import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authConfig } from "../../../auth/src/config";

/**
 * Server guards of the SaaS app (`apps/saas/src/lib/auth-server.ts`):
 * a temporary ban ends at `banExpires`, an impersonation session ends
 * after `authConfig.admin.impersonationMinutes` (signed out server-side),
 * and the admin area is closed to impersonation sessions.
 */

const SAAS = join(import.meta.dirname, "../../../../apps/saas");
const AUTH_SERVER = join(SAAS, "src/lib/auth-server.ts");
// Modules are mocked by the path the app resolves them to — this package
// does not depend on them itself.
const resolveFromApp = createRequire(join(SAAS, "package.json")).resolve;

class RedirectSignal extends Error {
	constructor(readonly to: string) {
		super(`redirect:${to}`);
	}
}

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	signOut: vi.fn(),
	endExpiredImpersonation: vi.fn(),
	hasImpersonatorLostAccess: vi.fn(),
}));

type AuthServer = {
	getSession: () => Promise<unknown>;
	requireAuth: () => Promise<unknown>;
	requireAdmin: () => Promise<unknown>;
};
let authServer: AuthServer;

beforeAll(async () => {
	vi.doMock(resolveFromApp("@fuutu/auth"), () => ({
		auth: { api: { getSession: mocks.getSession, signOut: mocks.signOut } },
	}));
	vi.doMock(resolveFromApp("@fuutu/auth/impersonation-expiry"), () => ({
		endExpiredImpersonation: mocks.endExpiredImpersonation,
	}));
	vi.doMock(resolveFromApp("@fuutu/auth/impersonation-access"), () => ({
		hasImpersonatorLostAccess: mocks.hasImpersonatorLostAccess,
	}));
	vi.doMock(resolveFromApp("@fuutu/db"), () => ({
		countOrganizationsForUser: vi.fn(),
		getOrganizationBySlug: vi.fn(),
	}));
	vi.doMock(resolveFromApp("next/headers"), () => ({
		headers: async () => new Headers({ cookie: "session=1" }),
	}));
	vi.doMock(resolveFromApp("next/navigation"), () => ({
		redirect: (to: string) => {
			throw new RedirectSignal(to);
		},
	}));
	// No request scope in tests — `cache` must not memoize across cases.
	vi.doMock(resolveFromApp("react"), () => ({
		cache: <T>(fn: T) => fn,
	}));
	authServer = (await import(/* @vite-ignore */ AUTH_SERVER)) as AuthServer;
}, 30_000);

const MINUTE = 60_000;
const IMPERSONATION_MS = 60 * MINUTE;

function session(
	user: Record<string, unknown>,
	inner: Record<string, unknown> = {},
) {
	return {
		user: { id: "user-2", email: "ada@fuutu.local", role: "user", ...user },
		session: {
			id: "sess-1",
			createdAt: new Date(),
			impersonatedBy: null,
			...inner,
		},
	};
}

async function redirectOf(run: () => Promise<unknown>): Promise<string | null> {
	try {
		await run();
		return null;
	} catch (err) {
		if (err instanceof RedirectSignal) return err.to;
		throw err;
	}
}

beforeEach(() => {
	mocks.getSession.mockReset();
	mocks.signOut.mockReset();
	mocks.endExpiredImpersonation.mockReset();
	mocks.hasImpersonatorLostAccess.mockReset().mockResolvedValue(false);
});

const EXPIRED_IMPERSONATION = {
	id: "sess-1",
	userId: "user-2",
	impersonatedBy: "admin-1",
	createdAt: new Date(Date.now() - 2 * 60 * 60_000),
};

describe("requireAuth", () => {
	it("sends a running ban to the suspended page", async () => {
		mocks.getSession.mockResolvedValue(
			session({ banned: true, banExpires: new Date(Date.now() + MINUTE) }),
		);
		expect(await redirectOf(authServer.requireAuth)).toBe("/auth/suspended");
	});

	it("lets a user in once a temporary ban has expired", async () => {
		mocks.getSession.mockResolvedValue(
			session({ banned: true, banExpires: new Date(Date.now() - MINUTE) }),
		);
		expect(await redirectOf(authServer.requireAuth)).toBeNull();
	});

	it("signs an expired impersonation out and sends it to sign-in", async () => {
		mocks.getSession.mockResolvedValue(
			session(
				{},
				{
					impersonatedBy: "admin-1",
					createdAt: new Date(Date.now() - IMPERSONATION_MS - MINUTE),
				},
			),
		);
		expect(await redirectOf(authServer.requireAuth)).toBe(
			authConfig.redirects.afterSignOut,
		);
		expect(mocks.signOut).toHaveBeenCalledWith({
			headers: expect.any(Headers),
		});
	});

	it("ends the expired impersonation (row deleted and audited) before signing out", async () => {
		mocks.getSession.mockResolvedValue(session({}, EXPIRED_IMPERSONATION));
		await redirectOf(authServer.requireAuth);
		expect(mocks.endExpiredImpersonation).toHaveBeenCalledWith(
			expect.objectContaining({ id: "sess-1", impersonatedBy: "admin-1" }),
		);
		expect(
			mocks.endExpiredImpersonation.mock.invocationCallOrder[0],
		).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0] ?? 0);
	});

	it("still redirects when the expired session is already gone", async () => {
		mocks.getSession.mockResolvedValue(
			session(
				{},
				{
					impersonatedBy: "admin-1",
					createdAt: new Date(Date.now() - IMPERSONATION_MS - MINUTE),
				},
			),
		);
		mocks.signOut.mockRejectedValue(new Error("session not found"));
		expect(await redirectOf(authServer.requireAuth)).toBe(
			authConfig.redirects.afterSignOut,
		);
	});

	it("keeps an impersonation inside its window", async () => {
		mocks.getSession.mockResolvedValue(
			session({}, { impersonatedBy: "admin-1", createdAt: new Date() }),
		);
		expect(await redirectOf(authServer.requireAuth)).toBeNull();
		expect(mocks.signOut).not.toHaveBeenCalled();
	});
});

describe("getSession", () => {
	it("reports an expired impersonation as signed out (no sign-in redirect loop)", async () => {
		mocks.getSession.mockResolvedValue(
			session(
				{},
				{
					impersonatedBy: "admin-1",
					createdAt: new Date(Date.now() - IMPERSONATION_MS - MINUTE),
				},
			),
		);
		expect(await authServer.getSession()).toBeNull();
		// The sign-in page reads getSession — no sign-out side effect there.
		expect(mocks.signOut).not.toHaveBeenCalled();
	});

	it("ends the expired impersonation's session row (audited once)", async () => {
		mocks.getSession.mockResolvedValue(session({}, EXPIRED_IMPERSONATION));
		await authServer.getSession();
		expect(mocks.endExpiredImpersonation).toHaveBeenCalledWith(
			expect.objectContaining({ id: "sess-1", impersonatedBy: "admin-1" }),
		);
	});

	it("leaves sessions inside the window alone", async () => {
		mocks.getSession.mockResolvedValue(
			session({}, { impersonatedBy: "admin-1", createdAt: new Date() }),
		);
		expect(await authServer.getSession()).not.toBeNull();
		expect(mocks.endExpiredImpersonation).not.toHaveBeenCalled();
	});
	it("reports an impersonation whose admin lost access as signed out", async () => {
		const current = session(
			{},
			{ impersonatedBy: "admin-1", createdAt: new Date() },
		);
		mocks.getSession.mockResolvedValue(current);
		mocks.hasImpersonatorLostAccess.mockResolvedValue(true);
		expect(await authServer.getSession()).toBeNull();
		expect(mocks.hasImpersonatorLostAccess).toHaveBeenCalledWith(
			current.session,
		);
		expect(await redirectOf(authServer.requireAuth)).toBe("/auth/sign-in");
	});
});

describe("requireAdmin", () => {
	it("lets a system admin in", async () => {
		mocks.getSession.mockResolvedValue(session({ role: "admin" }));
		expect(await redirectOf(authServer.requireAdmin)).toBeNull();
	});

	it("keeps a non-admin out", async () => {
		mocks.getSession.mockResolvedValue(session({ role: "user" }));
		expect(await redirectOf(authServer.requireAdmin)).toBe(
			"/dashboard?error=forbidden",
		);
	});

	it("keeps an impersonation session out of the admin area", async () => {
		mocks.getSession.mockResolvedValue(
			session(
				{ role: "admin" },
				{ impersonatedBy: "admin-9", createdAt: new Date() },
			),
		);
		expect(await redirectOf(authServer.requireAdmin)).toBe(
			"/dashboard?error=forbidden",
		);
	});
});
