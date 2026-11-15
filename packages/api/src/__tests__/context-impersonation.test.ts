import type { Context as HonoContext } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/auth", () => ({
	auth: { api: { getSession: vi.fn() } },
}));

vi.mock("@fuutu/db", () => ({
	API_KEY_PREFIX: "futu_sk_",
	verifyApiKeyWithOwner: vi.fn(),
	getOrganizationMemberRole: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
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
			impersonatedBy,
			createdAt: new Date(Date.now() - ms),
			// Better Auth may have refreshed the expiry — must not matter.
			expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
		},
	};
}

describe("createContext — impersonation time limit", () => {
	beforeEach(() => vi.clearAllMocks());

	it("keeps an impersonation session inside its window", async () => {
		const session = sessionStartedAgo(WINDOW_MS - 60_000, "admin-1");
		vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
		const ctx = await createContext({
			context: fakeHonoContext(new Headers()),
		});
		expect(ctx.session).toBe(session);
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

	it("never expires a user's own session by age", async () => {
		const session = sessionStartedAgo(10 * WINDOW_MS, null);
		vi.mocked(auth.api.getSession).mockResolvedValue(session as never);
		const ctx = await createContext({
			context: fakeHonoContext(new Headers()),
		});
		expect(ctx.session).toBe(session);
	});
});
