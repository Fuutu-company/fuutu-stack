import type { Context as HonoContext } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/auth", () => ({
	auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@fuutu/auth/impersonation-expiry", () => ({
	endExpiredImpersonation: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	API_KEY_PREFIX: "futu_sk_",
	verifyApiKeyWithOwner: vi.fn(),
	getOrganizationMemberRole: vi.fn(),
	getUserAccessState: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
const { getUserAccessState } = await import("@fuutu/db");
const { endExpiredImpersonation } = await import(
	"@fuutu/auth/impersonation-expiry"
);
const { authConfig } = await import("@fuutu/auth/config");
const { createContext } = await import("../context");

const fakeHonoContext = (headers: Headers) =>
	({ req: { raw: { headers } } }) as unknown as HonoContext;

const WINDOW_MS = authConfig.admin.impersonationMinutes * 60_000;

function sessionStartedAgo(ms: number, impersonatedBy: string | null) {
	return {
		user: { id: "user-2", banned: false },
		session: {
			id: "sess-1",
			userId: "user-2",
			impersonatedBy,
			createdAt: new Date(Date.now() - ms),
			// Better Auth may have refreshed the expiry — must not matter.
			expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
		},
	};
}

const IMPERSONATOR = {
	id: "admin-1",
	email: "admin@fuutu.local",
	role: "admin",
	banned: false,
	banExpires: null,
};

describe("createContext — impersonation time limit", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getUserAccessState).mockResolvedValue(IMPERSONATOR);
	});

	it("keeps an impersonation session inside its window", async () => {
		const session = sessionStartedAgo(WINDOW_MS - 60_000, "admin-1");
		vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
		const ctx = await createContext({
			context: fakeHonoContext(new Headers()),
		});
		expect(ctx.session).toBe(session);
		expect(endExpiredImpersonation).not.toHaveBeenCalled();
	});

	it("treats an expired impersonation session as signed out", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			sessionStartedAgo(WINDOW_MS + 1, "admin-1") as never,
		);
		const ctx = await createContext({
			context: fakeHonoContext(new Headers()),
		});
		expect(ctx.session).toBeNull();
		expect(ctx.apiKey).toBeNull();
	});

	it("ends the expired impersonation (row deleted and audited once)", async () => {
		const expired = sessionStartedAgo(WINDOW_MS + 1, "admin-1");
		vi.mocked(auth.api.getSession).mockResolvedValue(expired as never);
		await createContext({ context: fakeHonoContext(new Headers()) });
		expect(endExpiredImpersonation).toHaveBeenCalledOnce();
		expect(endExpiredImpersonation).toHaveBeenCalledWith(expired.session);
	});

	it("never expires a user's own session by age", async () => {
		const session = sessionStartedAgo(10 * WINDOW_MS, null);
		vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
		const ctx = await createContext({
			context: fakeHonoContext(new Headers()),
		});
		expect(ctx.session).toBe(session);
	});
});

describe("createContext — impersonator must still be an admin", () => {
	beforeEach(() => vi.clearAllMocks());

	async function contextFor(impersonator: unknown) {
		vi.mocked(getUserAccessState).mockResolvedValue(impersonator as never);
		vi.mocked(auth.api.getSession).mockResolvedValue(
			sessionStartedAgo(60_000, "admin-1") as never,
		);
		return createContext({ context: fakeHonoContext(new Headers()) });
	}

	it("keeps the session while the impersonator is an admin", async () => {
		const ctx = await contextFor(IMPERSONATOR);
		expect(getUserAccessState).toHaveBeenCalledWith("admin-1");
		expect(ctx.session).not.toBeNull();
	});

	it.each([
		["was demoted", { ...IMPERSONATOR, role: "user" }],
		["is banned", { ...IMPERSONATOR, banned: true }],
		["was deleted", null],
	])("signs out when the impersonator %s", async (_label, impersonator) => {
		const ctx = await contextFor(impersonator);
		expect(ctx.session).toBeNull();
		expect(ctx.apiKey).toBeNull();
	});

	it("never reads the database for a user's own session", async () => {
		vi.mocked(auth.api.getSession).mockResolvedValue(
			sessionStartedAgo(60_000, null) as never,
		);
		await createContext({ context: fakeHonoContext(new Headers()) });
		expect(getUserAccessState).not.toHaveBeenCalled();
	});
});
