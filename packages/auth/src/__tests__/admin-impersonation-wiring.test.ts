import { APIError } from "better-auth/api";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Impersonation wiring of the Better Auth instance: the session duration
 * comes from `authConfig.admin.impersonationMinutes`, the guard runs in
 * `hooks.before`, and `auth.session_created` names the impersonating admin.
 */

vi.mock("@fuutu/env/saas", () => ({
	env: {
		BETTER_AUTH_URL: "http://localhost:3000",
		BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-12",
		CORS_ORIGIN: "http://localhost:3000",
		NODE_ENV: "test",
		NEXT_PUBLIC_SAAS_URL: undefined,
		FUUTU_DISABLE_RATE_LIMIT: true,
	},
}));

vi.mock("@fuutu/db", () => ({
	getUserByEmail: vi.fn(),
	prismaAuditSink: vi.fn(),
	revokeOAuthTokensForUser: vi.fn(),
	claimUserCreatedEvent: vi.fn(),
	resetUserCreatedEvent: vi.fn(),
	countOrganizationMembers: vi.fn(),
	getPurchasesByUserId: vi.fn(),
	findPendingInvitation: vi.fn(),
	findPendingInvitationById: vi.fn(),
}));

vi.mock("@fuutu/db/internal/client", () => ({ db: {} }));

vi.mock("@fuutu/payments", () => ({
	createCustomerForUser: vi.fn(),
}));

vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));

vi.mock("../hooks/audit", () => ({
	logSignUp: vi.fn(),
	logSessionCreated: vi.fn(),
}));

vi.mock("../hooks/impersonation-guard", () => ({
	assertNotImpersonating: vi.fn(),
}));

const IMPORT_TIMEOUT = 30_000;

type AuthModule = typeof import("../index");
let auth: AuthModule["auth"];

beforeAll(async () => {
	({ auth } = await import("../index"));
}, IMPORT_TIMEOUT);

describe("admin plugin", () => {
	it("limits impersonation sessions to authConfig.admin.impersonationMinutes", async () => {
		const { authConfig } = await import("../config");
		const plugin = auth.options.plugins?.find((p) => p.id === "admin") as
			| { options?: { impersonationSessionDuration?: unknown } }
			| undefined;
		expect(plugin?.options?.impersonationSessionDuration).toBe(
			authConfig.admin.impersonationMinutes * 60,
		);
		expect(authConfig.admin.impersonationMinutes * 60).toBe(3600);
	});
});

describe("hooks.before", () => {
	it("runs the impersonation guard with the endpoint path", async () => {
		const { assertNotImpersonating } = await import(
			"../hooks/impersonation-guard"
		);
		vi.mocked(assertNotImpersonating).mockRejectedValueOnce(
			new APIError("FORBIDDEN", { code: "IMPERSONATION_FORBIDDEN" }),
		);
		await expect(
			auth.api.changePassword({
				body: {
					currentPassword: "Old-Passw0rd!",
					newPassword: "New-Passw0rd!",
				},
				headers: new Headers(),
			}),
		).rejects.toMatchObject({ body: { code: "IMPERSONATION_FORBIDDEN" } });
		expect(assertNotImpersonating).toHaveBeenCalledWith(
			expect.objectContaining({ path: "/change-password" }),
		);
	});
});

describe("databaseHooks.session.create.after", () => {
	it("passes impersonatedBy to the session audit", async () => {
		const { logSessionCreated } = await import("../hooks/audit");
		const after = auth.options.databaseHooks?.session?.create?.after;
		expect(after).toBeTypeOf("function");
		await after?.({
			id: "s1",
			userId: "user-2",
			token: "t",
			expiresAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
			ipAddress: "203.0.113.5",
			userAgent: "UA",
			impersonatedBy: "admin-1",
		});
		expect(logSessionCreated).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "user-2", impersonatedBy: "admin-1" }),
		);
	});

	it("passes null for a normal sign-in", async () => {
		const { logSessionCreated } = await import("../hooks/audit");
		vi.mocked(logSessionCreated).mockClear();
		await auth.options.databaseHooks?.session?.create?.after?.({
			id: "s2",
			userId: "user-3",
			token: "t",
			expiresAt: new Date(),
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		expect(logSessionCreated).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "user-3", impersonatedBy: null }),
		);
	});
});
