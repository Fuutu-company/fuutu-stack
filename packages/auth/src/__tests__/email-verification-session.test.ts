import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Loads the full module inside a hook or test: slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * The sign-up verification link (`/verify-email`, no `requestType`) counts
 * only together with a session of the same user: a squatter who signed up
 * with someone else's address must not get the account verified by the
 * owner's click on the genuine mail. Real `auth` instance on an in-memory
 * database.
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
	revokeApiKeysForUser: vi.fn(),
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
vi.mock("../hooks/audit", () => ({
	logSignUp: vi.fn(),
	logSessionCreated: vi.fn(),
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

const ORIGIN = "http://localhost:3000";
const ALICE = "alice@fuutu.dev";
const BOB = "bob@fuutu.dev";

let auth: typeof import("../index")["auth"];

beforeAll(async () => {
	({ auth } = await import("../index"));
}, 30_000);

beforeEach(() => {
	for (const model of MODELS) store[model] = [];
	sendEmail.mockReset();
});

/** Signs up through HTTP; returns the session cookie header. */
async function signUp(email: string): Promise<string> {
	const res = await auth.handler(
		new Request(`${ORIGIN}/api/auth/sign-up/email`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: ORIGIN },
			body: JSON.stringify({
				email,
				password: "Str0ng-Passw0rd!",
				name: email.split("@")[0],
				callbackURL: "/dashboard",
			}),
		}),
	);
	expect(res.status).toBe(200);
	return res.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.join("; ");
}

/** The verification link mailed to `email` on sign-up. */
function verificationLink(email: string): URL {
	const url = sendEmail.mock.calls.find(
		([mail]) => mail.template === "email-verification" && mail.to === email,
	)?.[0].data.verificationUrl;
	expect(url).toBeTypeOf("string");
	return new URL(String(url));
}

const isVerified = (email: string) =>
	store.user?.find((row) => row.email === email)?.emailVerified === true;

/** Opens the link like a browser navigation (redirect mode). */
const openLink = (link: URL, cookie?: string) =>
	auth.handler(
		new Request(link, {
			redirect: "manual",
			headers: cookie ? { cookie } : {},
		}),
	);

/** Calls `/verify-email` like the app's verify page (JSON, no callback). */
const verifyByFetch = (link: URL, cookie?: string) =>
	auth.handler(
		new Request(
			`${ORIGIN}/api/auth/verify-email?token=${link.searchParams.get("token")}`,
			{ headers: cookie ? { cookie } : {} },
		),
	);

describe("sign-up verification link needs the same user's session", () => {
	it("without a session: no verification, redirect to the verify page that sends to sign-in", async () => {
		await signUp(ALICE);
		const link = verificationLink(ALICE);

		const res = await openLink(link);
		expect(res.status).toBe(302);
		const location = new URL(String(res.headers.get("location")));
		expect(location.pathname).toBe("/auth/verify");
		// The token and the landing page survive the sign-in round trip.
		expect(location.searchParams.get("token")).toBe(
			link.searchParams.get("token"),
		);
		expect(location.searchParams.get("callbackURL")).toBe("/dashboard");
		expect(isVerified(ALICE)).toBe(false);

		const json = await verifyByFetch(link);
		expect(json.status).toBe(401);
		expect(await json.json()).toMatchObject({
			code: "SIGN_IN_TO_VERIFY_EMAIL",
		});
		expect(isVerified(ALICE)).toBe(false);
	});

	it("with another user's session: refused", async () => {
		await signUp(ALICE);
		const bob = await signUp(BOB);
		const link = verificationLink(ALICE);

		const json = await verifyByFetch(link, bob);
		expect(json.status).toBe(403);
		expect(await json.json()).toMatchObject({
			code: "EMAIL_VERIFICATION_OTHER_ACCOUNT",
		});

		const res = await openLink(link, bob);
		expect(res.status).toBe(302);
		expect(new URL(String(res.headers.get("location"))).pathname).toBe(
			"/auth/verify",
		);
		expect(isVerified(ALICE)).toBe(false);
		expect(isVerified(BOB)).toBe(false);
	});

	it("with the same user's session: verified (link and fetch)", async () => {
		const alice = await signUp(ALICE);
		const link = verificationLink(ALICE);

		const res = await openLink(link, alice);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/dashboard");
		expect(isVerified(ALICE)).toBe(true);

		const bob = await signUp(BOB);
		const json = await verifyByFetch(verificationLink(BOB), bob);
		expect(json.status).toBe(200);
		expect(isVerified(BOB)).toBe(true);
	});

	it("leaves the change-email confirmation link as is (no session needed)", async () => {
		await signUp(ALICE);
		const row = store.user?.find((user) => user.email === ALICE);
		if (row) row.emailVerified = true;
		const signIn = await auth.handler(
			new Request(`${ORIGIN}/api/auth/sign-in/email`, {
				method: "POST",
				headers: { "content-type": "application/json", origin: ORIGIN },
				body: JSON.stringify({ email: ALICE, password: "Str0ng-Passw0rd!" }),
			}),
		);
		const cookie = signIn.headers
			.getSetCookie()
			.map((c) => c.split(";")[0])
			.join("; ");
		const change = await auth.handler(
			new Request(`${ORIGIN}/api/auth/change-email`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: ORIGIN,
					cookie,
				},
				body: JSON.stringify({
					newEmail: "alice-new@fuutu.dev",
					callbackURL: "/settings",
				}),
			}),
		);
		expect(change.status).toBe(200);
		const confirmUrl = sendEmail.mock.calls.find(
			([mail]) => mail.template === "email-change-verification",
		)?.[0].data.verificationUrl;
		sendEmail.mockClear();

		const res = await openLink(new URL(String(confirmUrl)));
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe("/settings");
		expect(
			sendEmail.mock.calls.some(([mail]) => mail.to === "alice-new@fuutu.dev"),
		).toBe(true);
	});

	it("leaves an invalid token to Better Auth (no sign-in detour)", async () => {
		const res = await auth.handler(
			new Request(`${ORIGIN}/api/auth/verify-email?token=invalid`),
		);
		expect(res.status).toBe(401);
		expect(await res.json()).toMatchObject({ code: "INVALID_TOKEN" });
	});
});
