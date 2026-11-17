import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Loads the full module inside a hook or test: slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * With `requireEmailVerification` an unverified account cannot sign in —
 * nor can a squatter — so the sign-up link must verify without a session
 * (hooks/email-verification-session.ts stays out of the way, or no one
 * could ever verify). Real `auth` instance on an in-memory database.
 */

vi.mock("../config", async (importOriginal) => {
	const { authConfig } = await importOriginal<typeof import("../config")>();
	return {
		authConfig: {
			...authConfig,
			signup: { ...authConfig.signup, requireEmailVerification: true },
		},
	};
});

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

let auth: typeof import("../index")["auth"];

beforeAll(async () => {
	({ auth } = await import("../index"));
}, 30_000);

beforeEach(() => {
	for (const model of MODELS) store[model] = [];
	sendEmail.mockReset();
});

describe("sign-up verification link with requireEmailVerification", () => {
	it("verifies without a session (sign-in is refused until then)", async () => {
		const res = await auth.handler(
			new Request(`${ORIGIN}/api/auth/sign-up/email`, {
				method: "POST",
				headers: { "content-type": "application/json", origin: ORIGIN },
				body: JSON.stringify({
					email: ALICE,
					password: "Str0ng-Passw0rd!",
					name: "Alice",
					callbackURL: "/dashboard",
				}),
			}),
		);
		expect(res.status).toBe(200);
		const link = sendEmail.mock.calls.find(
			([mail]) => mail.template === "email-verification",
		)?.[0].data.verificationUrl;

		const opened = await auth.handler(
			new Request(String(link), { redirect: "manual" }),
		);
		expect(opened.status).toBe(302);
		expect(opened.headers.get("location")).toBe("/dashboard");
		expect(store.user?.find((row) => row.email === ALICE)?.emailVerified).toBe(
			true,
		);
	});
});
