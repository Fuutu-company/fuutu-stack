import { createRequire } from "node:module";
import { join } from "node:path";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authConfig } from "../../../auth/src/config";

/**
 * Server guards of the SaaS app (`apps/saas/src/lib/auth-server.ts`):
 * a temporary ban ends at `banExpires`, an impersonation session ends
 * after `authConfig.admin.impersonationMinutes` (signed out server-side),
 * the admin area is closed to impersonation sessions, and an org route
 * answers 404 to anyone who is not a member of that org.
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

class NotFoundSignal extends Error {
	constructor() {
		super("not-found");
	}
}

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
	signOut: vi.fn(),
	endExpiredImpersonation: vi.fn(),
	endImpersonationIfAccessLost: vi.fn(),
	getOrganizationBySlug: vi.fn(),
	isOrganizationMember: vi.fn(),
	getFullOrganization: vi.fn(),
	requestPasswordResetCallback: vi.fn(),
	getUserAccessState: vi.fn(),
	isUserSessionLive: vi.fn(),
	pathname: "/dashboard",
}));

type AuthServer = {
	getSession: () => Promise<unknown>;
	requireAuth: () => Promise<unknown>;
	requireAdmin: () => Promise<unknown>;
	requireOrgMembership: (slug: string) => Promise<{ org: { id: string } }>;
	notFoundUnlessOrgMember: () => Promise<void>;
	isPasswordResetTokenValid: (token: string) => Promise<boolean>;
};
let authServer: AuthServer;

beforeAll(async () => {
	vi.doMock(resolveFromApp("@fuutu/auth"), () => ({
		auth: {
			api: {
				getSession: mocks.getSession,
				signOut: mocks.signOut,
				getFullOrganization: mocks.getFullOrganization,
				setActiveOrganization: vi.fn(),
				requestPasswordResetCallback: mocks.requestPasswordResetCallback,
			},
		},
	}));
	vi.doMock(resolveFromApp("@fuutu/auth/impersonation-expiry"), () => ({
		endExpiredImpersonation: mocks.endExpiredImpersonation,
	}));
	vi.doMock(resolveFromApp("@fuutu/auth/impersonation-access"), () => ({
		endImpersonationIfAccessLost: mocks.endImpersonationIfAccessLost,
	}));
	vi.doMock(resolveFromApp("@fuutu/db"), () => ({
		countOrganizationsForUser: vi.fn(),
		getOrganizationBySlug: mocks.getOrganizationBySlug,
		isOrganizationMember: mocks.isOrganizationMember,
		getUserAccessState: mocks.getUserAccessState,
		isUserSessionLive: mocks.isUserSessionLive,
	}));
	vi.doMock(resolveFromApp("next/headers"), () => ({
		headers: async () =>
			new Headers({ cookie: "session=1", "x-pathname": mocks.pathname }),
	}));
	vi.doMock(resolveFromApp("next/navigation"), () => ({
		redirect: (to: string) => {
			throw new RedirectSignal(to);
		},
		notFound: () => {
			throw new NotFoundSignal();
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
	mocks.endImpersonationIfAccessLost.mockReset().mockResolvedValue(false);
	mocks.getOrganizationBySlug.mockReset();
	mocks.isOrganizationMember.mockReset();
	mocks.getFullOrganization.mockReset();
	mocks.pathname = "/dashboard";
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

	it("signs a lost-access impersonation out like an expired one", async () => {
		mocks.getSession.mockResolvedValue(
			session({}, { impersonatedBy: "admin-1", createdAt: new Date() }),
		);
		mocks.endImpersonationIfAccessLost.mockResolvedValue(true);
		expect(await redirectOf(authServer.requireAuth)).toBe(
			authConfig.redirects.afterSignOut,
		);
		expect(mocks.signOut).toHaveBeenCalledWith({
			headers: expect.any(Headers),
		});
		expect(
			mocks.endImpersonationIfAccessLost.mock.invocationCallOrder[0],
		).toBeLessThan(mocks.signOut.mock.invocationCallOrder[0] ?? 0);
	});

	it("still redirects a lost-access impersonation when sign-out fails", async () => {
		mocks.getSession.mockResolvedValue(
			session({}, { impersonatedBy: "admin-1", createdAt: new Date() }),
		);
		mocks.endImpersonationIfAccessLost.mockResolvedValue(true);
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
		mocks.endImpersonationIfAccessLost.mockResolvedValue(true);
		expect(await authServer.getSession()).toBeNull();
		// Ends it (row deleted, audited once) — a restored role cannot revive it.
		expect(mocks.endImpersonationIfAccessLost).toHaveBeenCalledWith(
			current.session,
		);
	});
});

describe("requireAdmin", () => {
	beforeEach(() => {
		mocks.getUserAccessState.mockImplementation(async (id: string) => ({
			id,
			email: "ada@fuutu.local",
			role: "admin",
			banned: false,
			banExpires: null,
		}));
		mocks.isUserSessionLive.mockResolvedValue(true);
	});

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

	it("keeps a revoked admin session out (row gone, cookie cache still valid)", async () => {
		mocks.getSession.mockResolvedValue(session({ role: "admin" }));
		mocks.isUserSessionLive.mockResolvedValue(false);
		expect(await redirectOf(authServer.requireAdmin)).toBe(
			"/dashboard?error=forbidden",
		);
		expect(mocks.isUserSessionLive).toHaveBeenCalledWith({
			userId: "user-2",
			sessionId: "sess-1",
		});
	});

	it("keeps an admin demoted since the session was cached out", async () => {
		mocks.getSession.mockResolvedValue(session({ role: "admin" }));
		mocks.getUserAccessState.mockResolvedValue({
			id: "user-2",
			email: "ada@fuutu.local",
			role: "user",
			banned: false,
			banExpires: null,
		});
		expect(await redirectOf(authServer.requireAdmin)).toBe(
			"/dashboard?error=forbidden",
		);
	});

	it("keeps an admin banned since the session was cached out", async () => {
		mocks.getSession.mockResolvedValue(session({ role: "admin" }));
		mocks.getUserAccessState.mockResolvedValue({
			id: "user-2",
			email: "ada@fuutu.local",
			role: "admin",
			banned: true,
			banExpires: null,
		});
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

async function outcome(run: () => Promise<unknown>): Promise<string> {
	try {
		await run();
		return "rendered";
	} catch (err) {
		if (err instanceof NotFoundSignal) return "404";
		if (err instanceof RedirectSignal) return `redirect:${err.to}`;
		throw err;
	}
}

const ACME = { id: "org-acme", name: "Acme", slug: "acme" };

describe("requireOrgMembership", () => {
	beforeEach(() => {
		mocks.getSession.mockResolvedValue(session({ onboardingComplete: true }));
	});

	it("answers 404 to a signed-in user who is not a member", async () => {
		mocks.getOrganizationBySlug.mockResolvedValue(ACME);
		mocks.isOrganizationMember.mockResolvedValue(false);
		// Better Auth's getFullOrganization throws 403 for non-members — the
		// org error boundary then showed "Something went wrong" in the shell.
		mocks.getFullOrganization.mockRejectedValue(new Error("FORBIDDEN"));
		expect(await outcome(() => authServer.requireOrgMembership("acme"))).toBe(
			"404",
		);
		expect(mocks.isOrganizationMember).toHaveBeenCalledWith("user-2", ACME.id);
	});

	it("answers the same 404 for an unknown slug", async () => {
		mocks.getOrganizationBySlug.mockResolvedValue(null);
		expect(await outcome(() => authServer.requireOrgMembership("nobody"))).toBe(
			"404",
		);
	});

	it("lets a member in", async () => {
		mocks.getOrganizationBySlug.mockResolvedValue(ACME);
		mocks.isOrganizationMember.mockResolvedValue(true);
		const result = await authServer.requireOrgMembership("acme");
		expect(result.org).toEqual(ACME);
	});
});

describe("notFoundUnlessOrgMember (app layout, before the shell renders)", () => {
	beforeEach(() => {
		mocks.getSession.mockResolvedValue(session({ onboardingComplete: true }));
	});

	it("answers 404 for another org's page", async () => {
		mocks.pathname = "/organizations/acme/settings/billing";
		mocks.getOrganizationBySlug.mockResolvedValue(ACME);
		mocks.isOrganizationMember.mockResolvedValue(false);
		expect(await outcome(authServer.notFoundUnlessOrgMember)).toBe("404");
	});

	it("renders a member's org page", async () => {
		mocks.pathname = "/organizations/acme/dashboard";
		mocks.getOrganizationBySlug.mockResolvedValue(ACME);
		mocks.isOrganizationMember.mockResolvedValue(true);
		expect(await outcome(authServer.notFoundUnlessOrgMember)).toBe("rendered");
	});

	it("leaves routes outside an org alone", async () => {
		for (const pathname of ["/dashboard", "/organizations", "/settings"]) {
			mocks.pathname = pathname;
			expect(await outcome(authServer.notFoundUnlessOrgMember)).toBe(
				"rendered",
			);
		}
		expect(mocks.getOrganizationBySlug).not.toHaveBeenCalled();
	});
});

describe("isPasswordResetTokenValid", () => {
	/** Better Auth's GET /reset-password/:token answer (a redirect). */
	const redirectTo = (location: string) =>
		new Response(null, { status: 302, headers: { location } });

	beforeEach(() => {
		mocks.requestPasswordResetCallback.mockReset();
	});

	it("accepts a token Better Auth passes on", async () => {
		mocks.requestPasswordResetCallback.mockResolvedValue(
			redirectTo("http://localhost:3000/auth/reset-password?token=t-1"),
		);
		expect(await authServer.isPasswordResetTokenValid("t-1")).toBe(true);
		expect(mocks.requestPasswordResetCallback).toHaveBeenCalledWith(
			expect.objectContaining({ params: { token: "t-1" }, asResponse: true }),
		);
	});

	it("rejects a token Better Auth answers with INVALID_TOKEN", async () => {
		mocks.requestPasswordResetCallback.mockResolvedValue(
			redirectTo(
				"http://localhost:3000/auth/reset-password?error=INVALID_TOKEN",
			),
		);
		expect(await authServer.isPasswordResetTokenValid("bogus")).toBe(false);
	});

	it("rejects when the check itself fails", async () => {
		mocks.requestPasswordResetCallback.mockRejectedValue(new Error("db down"));
		expect(await authServer.isPasswordResetTokenValid("t-1")).toBe(false);
	});
});
