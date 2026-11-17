import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Account recovery revokes every live API key of the user (org keys
 * included) — never silently: an audit event records how many and why.
 * Real `auth` instance on an in-memory database.
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
	revokeApiKeysForUser: (...args: unknown[]) => revokeApiKeysForUser(...args),
	claimUserCreatedEvent: vi.fn(),
	resetUserCreatedEvent: vi.fn(),
	countOrganizationMembers: vi.fn(),
	findPendingInvitation: vi.fn(),
	findPendingInvitationById: vi.fn(),
}));
vi.mock("@fuutu/db/internal/client", () => ({ db: {} }));
vi.mock("@fuutu/payments", () => ({ createCustomerForUser: vi.fn() }));

const revokeApiKeysForUser = vi.fn();
const logApiKeysRevoked = vi.fn();
const sendEmail = vi.fn();
vi.mock("../lib/email", () => ({
	sendEmail: (...args: unknown[]) => sendEmail(...args),
}));
vi.mock("../hooks/audit", () => ({
	logSignUp: vi.fn(),
	logSessionCreated: vi.fn(),
	logApiKeysRevoked: (...args: unknown[]) => logApiKeysRevoked(...args),
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
const json = { "content-type": "application/json", origin: ORIGIN };

let auth: typeof import("../index")["auth"];

beforeAll(async () => {
	({ auth } = await import("../index"));
}, 30_000);

beforeEach(() => {
	for (const model of MODELS) store[model] = [];
	sendEmail.mockReset();
	logApiKeysRevoked.mockReset();
	revokeApiKeysForUser.mockReset();
	revokeApiKeysForUser.mockResolvedValue(2);
});

const post = (path: string, body: unknown) =>
	auth.handler(
		new Request(`${ORIGIN}/api/auth${path}`, {
			method: "POST",
			headers: json,
			body: JSON.stringify(body),
		}),
	);

const mailed = (template: string) =>
	sendEmail.mock.calls.find(([mail]) => mail.template === template)?.[0];

async function signUp(): Promise<string> {
	const res = await post("/sign-up/email", {
		email: ALICE,
		password: "Str0ng-Passw0rd!",
		name: "Alice",
	});
	expect(res.status).toBe(200);
	return String(store.user?.find((row) => row.email === ALICE)?.id);
}

describe("API keys revoked on account recovery are audited", () => {
	it("password reset: records the count with reason password_reset", async () => {
		const userId = await signUp();
		const requested = await post("/request-password-reset", {
			email: ALICE,
			redirectTo: "/auth/reset-password",
		});
		expect(requested.status).toBe(200);
		const resetUrl = new URL(String(mailed("password-reset")?.data.resetUrl));
		const token = resetUrl.pathname.split("/").pop();

		const reset = await post("/reset-password", {
			token,
			newPassword: "An0ther-Passw0rd!",
		});
		expect(reset.status).toBe(200);
		expect(revokeApiKeysForUser).toHaveBeenCalledWith(userId);
		expect(logApiKeysRevoked).toHaveBeenCalledWith({
			userId,
			count: 2,
			reason: "password_reset",
		});
	});

	it("magic-link mailbox proof: records the count with reason mailbox_proof", async () => {
		const userId = await signUp();
		const sent = await post("/sign-in/magic-link", { email: ALICE });
		expect(sent.status).toBe(200);
		const link = String(mailed("magic-link")?.data.magicLinkUrl);

		const res = await auth.handler(new Request(link, { redirect: "manual" }));
		expect(res.status).toBe(302);
		expect(revokeApiKeysForUser).toHaveBeenCalledWith(userId);
		expect(logApiKeysRevoked).toHaveBeenCalledWith({
			userId,
			count: 2,
			reason: "mailbox_proof",
		});
	});
});
