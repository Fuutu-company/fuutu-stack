import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Auth flows through the real `auth` instance on an in-memory database.
 *
 * Magic link with 2FA on: The session must never be created — a session that
 * is created and then ended in an after-hook leaves a window (and a cookie
 * a raw client may keep). Checked on the raw Set-Cookie list.
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

type Row = Record<string, unknown>;
const store = vi.hoisted(() => ({}) as Record<string, Row[]>);

vi.mock("better-auth/adapters/prisma", async () => {
	const { memoryAdapter: memory } = await import("better-auth/adapters/memory");
	return { prismaAdapter: () => memory(store) };
});

vi.mock("@fuutu/db", () => ({
	getUserByEmail: vi.fn(async () => null),
	getUserById: vi.fn(async () => null),
	prismaAuditSink: vi.fn(),
	revokeOAuthTokensForUser: vi.fn(),
	claimUserCreatedEvent: vi.fn(),
	resetUserCreatedEvent: vi.fn(),
	countOrganizationMembers: vi.fn(),
	findPendingInvitation: vi.fn(),
	findPendingInvitationById: vi.fn(),
}));
vi.mock("@fuutu/db/internal/client", () => ({ db: {} }));
vi.mock("@fuutu/payments", () => ({ createCustomerForUser: vi.fn() }));

const sendEmail = vi.fn();
vi.mock("../lib/email", () => ({
	sendEmail: (...args: unknown[]) => sendEmail(...args),
}));
const logSessionCreated = vi.fn();
vi.mock("../hooks/audit", () => ({
	logSignUp: vi.fn(),
	logSessionCreated: (...args: unknown[]) => logSessionCreated(...args),
}));

const MODELS = [
	"user",
	"session",
	"account",
	"verification",
	"twoFactor",
	"passkey",
	"organization",
	"member",
	"invitation",
	"rateLimit",
	"jwks",
	"oauthResource",
	"oauthClient",
	"oauthAccessToken",
	"oauthRefreshToken",
	"oauthConsent",
];

let auth: typeof import("../index")["auth"];

beforeAll(async () => {
	({ auth } = await import("../index"));
}, 30_000);

beforeEach(() => {
	for (const model of MODELS) store[model] = [];
	sendEmail.mockReset();
	logSessionCreated.mockReset();
});

const seedUser = (twoFactorEnabled: boolean, emailVerified = true) => {
	// emailVerified: false — magic-link verify promotes it on sign-in.
	const now = new Date();
	store.user?.push({
		id: "user-1",
		email: "ada@fuutu.dev",
		name: "Ada",
		emailVerified,
		twoFactorEnabled,
		createdAt: now,
		updatedAt: now,
	});
};

/** Requests a magic link and opens it like a raw HTTP client would. */
async function openMagicLink(): Promise<Response> {
	const sent = await auth.handler(
		new Request("http://localhost:3000/api/auth/sign-in/magic-link", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost:3000",
			},
			body: JSON.stringify({ email: "ada@fuutu.dev" }),
		}),
	);
	expect(sent.status).toBe(200);
	const link = sendEmail.mock.calls.find(
		([mail]) => mail.template === "magic-link",
	)?.[0].data.magicLinkUrl;
	expect(link).toBeTypeOf("string");
	return auth.handler(new Request(String(link), { redirect: "manual" }));
}

/** Session cookies in the response that carry a value. */
const liveSessionCookies = (res: Response) =>
	res.headers
		.getSetCookie()
		.filter((c) => /session_(token|data)=[^;]+/.test(c))
		.filter((c) => !/max-age=0/i.test(c));

describe("magic link with 2FA (raw Set-Cookie)", () => {
	it("sets no session cookie and creates no session for a 2FA user", async () => {
		seedUser(true);
		const res = await openMagicLink();
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toContain("error=TWO_FACTOR_REQUIRED");
		expect(liveSessionCookies(res)).toEqual([]);
		// Never created, not created-then-deleted: no window for its cookie.
		expect(logSessionCreated).not.toHaveBeenCalled();
		expect(store.session).toEqual([]);
	});

	it("signs a user without 2FA in (the cookie check above is meaningful)", async () => {
		seedUser(false);
		const res = await openMagicLink();
		expect(res.status).toBe(302);
		expect(liveSessionCookies(res).length).toBeGreaterThan(0);
		expect(logSessionCreated).toHaveBeenCalledTimes(1);
		expect(store.session).toHaveLength(1);
	});
});

describe("social sign-in with 2FA", () => {
	it("refuses the session the OAuth callback would create for a 2FA user", async () => {
		const before = auth.options.databaseHooks?.session?.create?.before;
		const ctx = {
			path: "/callback/:id",
			context: {
				...(await auth.$context),
				internalAdapter: {
					findUserById: async () => ({ twoFactorEnabled: true }),
				},
			},
			redirect: (url: string) => Object.assign(new Error("redirect"), { url }),
		};
		await expect(
			before?.(
				{ userId: "user-1" } as Parameters<NonNullable<typeof before>>[0],
				ctx as unknown as Parameters<NonNullable<typeof before>>[1],
			),
		).rejects.toMatchObject({
			url: expect.stringContaining("error=TWO_FACTOR_REQUIRED"),
		});
	});
});

const cookieHeader = (res: Response) =>
	res.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");

/** Signs up by password (email stays unverified) — session cookie header. */
async function signUp(): Promise<string> {
	const res = await auth.handler(
		new Request("http://localhost:3000/api/auth/sign-up/email", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost:3000",
			},
			body: JSON.stringify({
				email: "ada@fuutu.dev",
				password: "ValidPassw0rd!",
				name: "Ada",
			}),
		}),
	);
	expect(res.status).toBe(200);
	return cookieHeader(res);
}

describe("email change for an unverified account", () => {
	const changeEmail = (cookie: string) =>
		auth.handler(
			new Request("http://localhost:3000/api/auth/change-email", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "http://localhost:3000",
					cookie,
				},
				body: JSON.stringify({ newEmail: "attacker@evil.dev" }),
			}),
		);

	it("is refused, and no change link goes out", async () => {
		const cookie = await signUp();
		sendEmail.mockClear();
		const res = await changeEmail(cookie);
		expect(res.status).toBe(403);
		expect(await res.json()).toMatchObject({ code: "EMAIL_NOT_VERIFIED" });
		expect(sendEmail).not.toHaveBeenCalled();
	});

	it("sends the confirmation to the current address once verified", async () => {
		// Magic-link sign-in proves the mailbox: the email is verified.
		seedUser(false, false);
		const cookie = cookieHeader(await openMagicLink());
		sendEmail.mockClear();
		const res = await changeEmail(cookie);
		expect(res.status).toBe(200);
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "ada@fuutu.dev",
				template: "email-change-verification",
			}),
		);
	});
});

describe("organization invitations", () => {
	const seedOrg = (role: "owner" | "member") => {
		const now = new Date();
		store.organization?.push({
			id: "org-1",
			name: "Acme",
			slug: "acme",
			createdAt: now,
		});
		store.member?.push({
			id: "mem-1",
			organizationId: "org-1",
			userId: "user-1",
			role,
			createdAt: now,
		});
		store.invitation?.push({
			id: "inv-1",
			organizationId: "org-1",
			email: "invitee@acme.dev",
			role: "member",
			status: "pending",
			inviterId: "user-1",
			expiresAt: new Date(Date.now() + 86_400_000),
			createdAt: now,
		});
	};

	const fullOrganization = async (cookie: string) => {
		const res = await auth.handler(
			new Request(
				"http://localhost:3000/api/auth/organization/get-full-organization?organizationId=org-1",
				{ headers: { cookie } },
			),
		);
		expect(res.status).toBe(200);
		return (await res.json()) as { invitations: unknown[] };
	};

	it("are hidden from a plain member", async () => {
		seedUser(false);
		seedOrg("member");
		const org = await fullOrganization(cookieHeader(await openMagicLink()));
		expect(org.invitations).toEqual([]);
	});

	it("stay visible to an owner", async () => {
		seedUser(false);
		seedOrg("owner");
		const org = await fullOrganization(cookieHeader(await openMagicLink()));
		expect(org.invitations).toHaveLength(1);
	});
});
