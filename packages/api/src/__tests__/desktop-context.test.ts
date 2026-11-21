import type { Context as HonoContext } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Desktop access tokens on `/api/rpc` (config.features.desktop, C1/C6):
 * off → a non-API-key bearer is ignored exactly as before; on → a valid
 * desktop token authenticates as its user, pinned to its (member) org;
 * unmarked and session-only procedures refuse it (desktop-token-scope.test.ts).
 */

const desktop = vi.hoisted(() => ({ active: false }));

vi.mock("@fuutu/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@fuutu/auth/desktop-oauth", () => ({
	DESKTOP_ORG_CLAIM: "org_id",
	desktopOAuth: {
		get active() {
			return desktop.active;
		},
		clientId: "acme-desktop",
	},
	verifyDesktopAccessToken: vi.fn(),
}));
vi.mock("@fuutu/db", () => ({
	API_KEY_PREFIX: "futu_sk_",
	verifyApiKeyWithOwner: vi.fn(),
	getOrganizationMemberRole: vi.fn(),
	getOrganizationWithMembers: vi.fn(async (id: string) => ({
		id,
		members: [{ userId: "user-1" }],
	})),
	getUserById: vi.fn(),
}));

const { auth } = await import("@fuutu/auth");
const { verifyDesktopAccessToken } = await import("@fuutu/auth/desktop-oauth");
const { getUserById } = await import("@fuutu/db");
const { createContext } = await import("../context");
const { authProcedure } = await import("../orpc/procedures");
const { call } = await import("@orpc/server");

const ctxFor = (headers: Headers) =>
	createContext({
		context: { req: { raw: { headers } } } as unknown as HonoContext,
	});
const bearer = (token: string) =>
	new Headers({ authorization: `Bearer ${token}` });

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(auth.api.getSession).mockResolvedValue(null);
	vi.mocked(verifyDesktopAccessToken).mockResolvedValue({
		sub: "user-1",
		azp: "acme-desktop",
		jti: "tok-1",
		org_id: "org-1",
	} as never);
	vi.mocked(getUserById).mockResolvedValue({
		id: "user-1",
		email: "u@example.com",
		banned: false,
	} as never);
});

describe("desktop bearer — switch off", () => {
	it("leaves a non-API-key bearer unauthenticated, never verifying it", async () => {
		desktop.active = false;
		const ctx = await ctxFor(bearer("eyJ.desktop.token"));
		expect(verifyDesktopAccessToken).not.toHaveBeenCalled();
		expect(ctx.session).toBeNull();
		expect(ctx.apiKey).toBeNull();
		expect(ctx.desktop).toBeNull();
	});
});

describe("desktop bearer — switch on", () => {
	beforeEach(() => {
		desktop.active = true;
	});

	it("authenticates as the user, pinned to its member org", async () => {
		const ctx = await ctxFor(bearer("eyJ.desktop.token"));
		expect(verifyDesktopAccessToken).toHaveBeenCalledWith("eyJ.desktop.token");
		expect(ctx.session?.user.id).toBe("user-1");
		expect(ctx.apiKey).toEqual({
			id: "oauth:tok-1",
			organizationId: "org-1",
			desktop: true,
		});
		expect(ctx.desktop).toEqual({
			clientId: "acme-desktop",
			tokenId: "tok-1",
			organizationId: "org-1",
		});
	});

	it("stays anonymous for an invalid token (wrong audience, expired, forged)", async () => {
		vi.mocked(verifyDesktopAccessToken).mockRejectedValue(new Error("aud"));
		const ctx = await ctxFor(bearer("eyJ.mcp.token"));
		expect(ctx.session).toBeNull();
		expect(ctx.desktop).toBeNull();
	});

	it("refuses banned or deleted users", async () => {
		vi.mocked(getUserById).mockResolvedValue({
			id: "user-1",
			banned: true,
		} as never);
		expect((await ctxFor(bearer("t"))).session).toBeNull();
		vi.mocked(getUserById).mockResolvedValue(null);
		expect((await ctxFor(bearer("t"))).session).toBeNull();
	});

	it("never treats an API key bearer as a desktop token", async () => {
		await ctxFor(bearer("futu_sk_abc"));
		expect(verifyDesktopAccessToken).not.toHaveBeenCalled();
	});

	it("is refused by session-only procedures (money, credentials, org structure)", async () => {
		const ctx = await ctxFor(bearer("eyJ.desktop.token"));
		const sessionOnly = authProcedure({ sessionOnly: true }).handler(
			() => "ok",
		);
		await expect(
			call(sessionOnly, undefined, { context: ctx }),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		const unmarked = authProcedure().handler(() => "ok");
		await expect(
			call(unmarked, undefined, { context: ctx }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		const open = authProcedure({ desktopAllowed: true }).handler(() => "ok");
		await expect(call(open, undefined, { context: ctx })).resolves.toBe("ok");
	});
});
