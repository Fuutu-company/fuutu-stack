import type { Context as HonoContext } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Desktop access tokens are not unscoped API keys (security review C1-1):
 *
 *  (a) the token's org claim pins the caller to that org — after a
 *      membership check; a stale or missing claim pins to no org;
 *  (b) the `desktop` pseudo-scope feature (`apiConfig.apiKeyScopeFeatures`)
 *      gates API use — 402 without it, except the access-flow procedures
 *      the app needs to show "plan missing";
 *  (c) only procedures marked `desktopAllowed` accept the token.
 */

vi.mock("@fuutu/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@fuutu/auth/desktop-oauth", () => ({
	DESKTOP_ORG_CLAIM: "org_id",
	desktopOAuth: { active: true, clientId: "acme-desktop" },
	verifyDesktopAccessToken: vi.fn(),
}));
vi.mock("@fuutu/db", () => ({
	API_KEY_PREFIX: "futu_sk_",
	verifyApiKeyWithOwner: vi.fn(),
	getOrganizationMemberRole: vi.fn(),
	getOrganizationWithMembers: vi.fn(),
	getUserById: vi.fn(),
}));
vi.mock("@fuutu/payments", () => ({ getOrgEntitlement: vi.fn() }));

const { auth } = await import("@fuutu/auth");
const { verifyDesktopAccessToken } = await import("@fuutu/auth/desktop-oauth");
const db = await import("@fuutu/db");
const { getOrgEntitlement } = await import("@fuutu/payments");
const { apiConfig } = await import("../config");
const { createContext } = await import("../context");
const {
	authProcedure,
	desktopAccessFlow,
	desktopAllowed,
	protectedProcedure,
	PERMISSIONS,
} = await import("../orpc/procedures");
const { call } = await import("@orpc/server");
const { z } = await import("zod");

const ORG = "org-1";
const OTHER = "org-2";

const desktopCtx = () =>
	createContext({
		context: {
			req: {
				raw: {
					headers: new Headers({ authorization: "Bearer eyJ.desktop.token" }),
				},
			},
		} as unknown as HonoContext,
	});

function claim(orgId: string | undefined) {
	vi.mocked(verifyDesktopAccessToken).mockResolvedValue({
		sub: "user-1",
		azp: "acme-desktop",
		jti: "tok-1",
		...(orgId && { org_id: orgId }),
	} as never);
}

const orgInput = z.object({ organizationId: z.string() });

beforeEach(() => {
	vi.clearAllMocks();
	delete apiConfig.apiKeyScopeFeatures.desktop;
	vi.mocked(auth.api.getSession).mockResolvedValue(null);
	claim(ORG);
	vi.mocked(db.getUserById).mockResolvedValue({
		id: "user-1",
		email: "u@example.com",
		role: "user",
		banned: false,
	} as never);
	vi.mocked(db.getOrganizationWithMembers).mockImplementation(((id: string) =>
		Promise.resolve({
			id,
			name: id,
			slug: id,
			members: [
				{
					userId: "user-1",
					role: "owner",
					user: { email: "u@example.com" },
				},
			],
		})) as never);
	vi.mocked(getOrgEntitlement).mockResolvedValue({ features: [] } as never);
});

// Each test sets the plan gate itself, whatever the buyer's apiConfig sets.
const buyerScopeFeatures = { ...apiConfig.apiKeyScopeFeatures };
afterEach(() => {
	const features = apiConfig.apiKeyScopeFeatures;
	for (const key of Object.keys(features)) delete features[key];
	Object.assign(features, buyerScopeFeatures);
});

describe("(a) org pin", () => {
	it("pins the token's org after a membership check", async () => {
		const ctx = await desktopCtx();
		expect(ctx.apiKey).toEqual({
			id: "oauth:tok-1",
			organizationId: ORG,
			desktop: true,
		});
	});

	it("pins to no org when the claimed membership is gone", async () => {
		vi.mocked(db.getOrganizationWithMembers).mockResolvedValue({
			id: ORG,
			members: [{ userId: "someone-else", role: "owner", user: {} }],
		} as never);
		expect((await desktopCtx()).apiKey?.organizationId).toBeNull();
		claim(undefined);
		expect((await desktopCtx()).apiKey?.organizationId).toBeNull();
	});

	it("denies another org — protectedProcedure and authProcedure", async () => {
		const ctx = await desktopCtx();
		const plain = protectedProcedure
			.use(desktopAllowed)
			.input(orgInput)
			.handler(() => "ok");
		await expect(
			call(plain, { organizationId: ORG }, { context: ctx }),
		).resolves.toBe("ok");
		await expect(
			call(plain, { organizationId: OTHER }, { context: ctx }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });

		const orgScoped = authProcedure({
			org: { permission: PERMISSIONS.ORGANIZATION.VIEW },
			desktopAllowed: true,
		})
			.input(orgInput)
			.handler(() => "ok");
		await expect(
			call(orgScoped, { organizationId: OTHER }, { context: ctx }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("keeps user-level procedures, but no org at all without a pin", async () => {
		claim(undefined);
		const ctx = await desktopCtx();
		const userLevel = protectedProcedure
			.use(desktopAllowed)
			.handler(() => "me");
		await expect(call(userLevel, undefined, { context: ctx })).resolves.toBe(
			"me",
		);
		const plain = protectedProcedure
			.use(desktopAllowed)
			.input(orgInput)
			.handler(() => "ok");
		await expect(
			call(plain, { organizationId: ORG }, { context: ctx }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});

describe("(c) desktopAllowed opt-in", () => {
	it("denies a desktop token on an unmarked procedure", async () => {
		const ctx = await desktopCtx();
		const unmarkedAuth = authProcedure().handler(() => "ok");
		const unmarkedProtected = protectedProcedure.handler(() => "ok");
		await expect(
			call(unmarkedAuth, undefined, { context: ctx }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(
			call(unmarkedProtected, undefined, { context: ctx }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("admits it on marked procedures (option or middleware)", async () => {
		const ctx = await desktopCtx();
		const viaOption = authProcedure({ desktopAllowed: true }).handler(
			() => "ok",
		);
		const viaMiddleware = protectedProcedure
			.use(desktopAllowed)
			.handler(() => "ok");
		await expect(call(viaOption, undefined, { context: ctx })).resolves.toBe(
			"ok",
		);
		await expect(
			call(viaMiddleware, undefined, { context: ctx }),
		).resolves.toBe("ok");
	});

	it("leaves browser sessions and API keys untouched", async () => {
		const unmarked = authProcedure().handler(() => "ok");
		vi.mocked(auth.api.getSession).mockResolvedValue({
			user: { id: "user-1", role: "user" },
			session: { id: "s1" },
		} as never);
		const ctx = await desktopCtx();
		expect(ctx.desktop).toBeNull();
		await expect(call(unmarked, undefined, { context: ctx })).resolves.toBe(
			"ok",
		);
	});
});

describe("(b) desktop plan gate", () => {
	it("answers 402 without the `desktop` scope feature", async () => {
		apiConfig.apiKeyScopeFeatures.desktop = "products_desktop";
		const ctx = await desktopCtx();
		const marked = protectedProcedure.use(desktopAllowed).handler(() => "ok");
		await expect(
			call(marked, undefined, { context: ctx }),
		).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
	});

	it("keeps the access flow reachable so the app can show the upgrade", async () => {
		apiConfig.apiKeyScopeFeatures.desktop = "products_desktop";
		const ctx = await desktopCtx();
		const accessFlow = protectedProcedure
			.use(desktopAccessFlow)
			.handler(() => "session");
		await expect(call(accessFlow, undefined, { context: ctx })).resolves.toBe(
			"session",
		);
	});

	it("admits the token once the pinned org has the feature", async () => {
		apiConfig.apiKeyScopeFeatures.desktop = "products_desktop";
		vi.mocked(getOrgEntitlement).mockResolvedValue({
			features: ["products_desktop"],
		} as never);
		const ctx = await desktopCtx();
		const marked = protectedProcedure.use(desktopAllowed).handler(() => "ok");
		await expect(call(marked, undefined, { context: ctx })).resolves.toBe("ok");
		expect(getOrgEntitlement).toHaveBeenCalledWith(ORG);
	});
});
