import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	getUserAccessState: vi.fn(),
}));

const { getUserAccessState } = await import("@fuutu/db");
const { adminProcedure, protectedProcedure, systemAdminProcedure } =
	await import("../orpc/procedures");
const { runAuthorize } = await import("../orpc/middleware/authorize");
const { PERMISSIONS } = await import("@fuutu/rbac");

const HOUR = 3_600_000;

const admin = makeUser({ id: "admin-1", role: "admin" });
const adminContext = makeSession<Context>(admin);

/** Same admin, but the session was started by impersonation. */
function impersonatedContext(user = admin): Context {
	const ctx = makeSession<Context>(user);
	const inner = ctx.session?.session as { impersonatedBy?: string };
	inner.impersonatedBy = "admin-9";
	return ctx;
}

/** API-key requests carry `{ user }` only (createContext) plus `apiKey`. */
function apiKeyContext(user = admin): Context {
	return {
		session: { user },
		headers: new Headers(),
		apiKey: { id: "key-1", organizationId: null },
	} as unknown as Context;
}

const whoami = systemAdminProcedure(PERMISSIONS.USER.VIEW).handler(
	({ context }) => ({ id: context.user.id, role: context.user.role }),
);
const adminPing = adminProcedure.handler(() => "ok");

function dbState(overrides: Record<string, unknown> = {}) {
	return {
		id: "admin-1",
		email: "admin@fuutu.local",
		role: "admin",
		banned: false,
		banExpires: null,
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(getUserAccessState).mockResolvedValue(dbState() as never);
});

describe("systemAdminProcedure", () => {
	it("lets a system admin with an interactive session through", async () => {
		await expect(
			call(whoami, undefined, { context: adminContext }),
		).resolves.toEqual({ id: "admin-1", role: "admin" });
		expect(getUserAccessState).toHaveBeenCalledWith("admin-1");
	});

	it("rejects unauthenticated callers with 401", async () => {
		await expect(
			call(whoami, undefined, { context: makeSession<Context>(null) }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("rejects a system role user with 403", async () => {
		await expect(
			call(whoami, undefined, {
				context: makeSession<Context>(makeUser({ role: "user" })),
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects an admin's API key (admin power is interactive-only)", async () => {
		await expect(
			call(whoami, undefined, { context: apiKeyContext() }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(getUserAccessState).not.toHaveBeenCalled();
	});

	it("rejects a session without the inner session record", async () => {
		const ctx = {
			session: { user: admin },
			headers: new Headers(),
			apiKey: null,
		} as unknown as Context;
		await expect(
			call(whoami, undefined, { context: ctx }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects impersonation sessions", async () => {
		await expect(
			call(whoami, undefined, { context: impersonatedContext() }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("uses the database role, not the cached session role", async () => {
		vi.mocked(getUserAccessState).mockResolvedValue(
			dbState({ role: "user" }) as never,
		);
		await expect(
			call(whoami, undefined, { context: adminContext }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects an admin banned since the session was cached", async () => {
		vi.mocked(getUserAccessState).mockResolvedValue(
			dbState({ banned: true }) as never,
		);
		await expect(
			call(whoami, undefined, { context: adminContext }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("ignores a ban that has expired", async () => {
		vi.mocked(getUserAccessState).mockResolvedValue(
			dbState({
				banned: true,
				banExpires: new Date(Date.now() - HOUR),
			}) as never,
		);
		await expect(
			call(whoami, undefined, { context: adminContext }),
		).resolves.toEqual({ id: "admin-1", role: "admin" });
	});

	it("rejects when the user row is gone", async () => {
		vi.mocked(getUserAccessState).mockResolvedValue(null);
		await expect(
			call(whoami, undefined, { context: adminContext }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});

	it("rejects permissions the admin role does not hold", async () => {
		const create = systemAdminProcedure(
			PERMISSIONS.ADMIN_ORGANIZATION.CREATE,
		).handler(() => "created");
		await expect(
			call(create, undefined, { context: adminContext }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("adminProcedure", () => {
	it("is a system-admin procedure: API keys of admins are rejected", async () => {
		await expect(
			call(adminPing, undefined, { context: apiKeyContext() }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects an impersonation session", async () => {
		await expect(
			call(adminPing, undefined, { context: impersonatedContext() }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("still serves admins", async () => {
		await expect(
			call(adminPing, undefined, { context: adminContext }),
		).resolves.toBe("ok");
	});
});

describe("temporary bans (banExpires)", () => {
	const whoamiProtected = protectedProcedure.handler(
		({ context }) => context.user.id,
	);
	const expired = makeUser({
		id: "u-exp",
		banned: true,
		banExpires: new Date(Date.now() - HOUR),
	});
	const active = makeUser({
		id: "u-act",
		banned: true,
		banExpires: new Date(Date.now() + HOUR),
	});

	it("protectedProcedure lets an expired ban through", async () => {
		await expect(
			call(whoamiProtected, undefined, {
				context: makeSession<Context>(expired),
			}),
		).resolves.toBe("u-exp");
	});

	it("protectedProcedure rejects a ban that is still running", async () => {
		await expect(
			call(whoamiProtected, undefined, {
				context: makeSession<Context>(active),
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("runAuthorize lets an expired ban through", async () => {
		await expect(
			runAuthorize({}, makeSession<Context>(expired), {}),
		).resolves.toMatchObject({ user: { id: "u-exp" } });
	});

	it("runAuthorize rejects a ban that is still running", async () => {
		await expect(
			runAuthorize({}, makeSession<Context>(active), {}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("AuthorizeOptions.denyImpersonation", () => {
	const user = makeUser({ id: "user-2" });

	it("rejects an impersonation session when set", async () => {
		await expect(
			runAuthorize({ denyImpersonation: true }, impersonatedContext(user), {}),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Not allowed while impersonating a user",
		});
	});

	it("allows the user's own session", async () => {
		await expect(
			runAuthorize({ denyImpersonation: true }, makeSession<Context>(user), {}),
		).resolves.toMatchObject({ user: { id: "user-2" } });
	});

	it("does not affect procedures that leave it unset", async () => {
		await expect(
			runAuthorize({}, impersonatedContext(user), {}),
		).resolves.toMatchObject({ user: { id: "user-2" } });
	});
});
