import { describe, expect, it, vi } from "vitest";

/**
 * Better Auth trusts CORS_ORIGIN (callback URLs, its own origin check)
 * only with the explicit `CORS_CREDENTIALS` opt-in — the API's CSRF guard
 * follows the same rule.
 */

const env = vi.hoisted(() => ({
	BETTER_AUTH_URL: "http://localhost:3000",
	BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-12",
	CORS_ORIGIN: "https://example.com",
	CORS_CREDENTIALS: false,
	NODE_ENV: "test",
	NEXT_PUBLIC_SAAS_URL: undefined,
	FUUTU_DISABLE_RATE_LIMIT: false,
}));

vi.mock("@fuutu/env/saas", () => ({ env }));

vi.mock("@fuutu/db", () => ({
	getUserByEmail: vi.fn(),
	prismaAuditSink: vi.fn(),
	claimUserCreatedEvent: vi.fn(),
	resetUserCreatedEvent: vi.fn(),
	countOrganizationMembers: vi.fn(),
	getPurchasesByUserId: vi.fn(),
	findPendingInvitation: vi.fn(),
	findPendingInvitationById: vi.fn(),
}));
vi.mock("@fuutu/db/internal/client", () => ({ db: {} }));
vi.mock("@fuutu/payments", () => ({ createCustomerForUser: vi.fn() }));
vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));

async function trustedOrigins(credentials: boolean) {
	vi.resetModules();
	env.CORS_CREDENTIALS = credentials;
	const { auth } = await import("../index");
	return auth.options.trustedOrigins;
}

describe("Better Auth trustedOrigins", () => {
	it("leaves CORS_ORIGIN out by default", async () => {
		expect(await trustedOrigins(false)).not.toContain("https://example.com");
	});

	it("trusts CORS_ORIGIN with CORS_CREDENTIALS", async () => {
		expect(await trustedOrigins(true)).toContain("https://example.com");
	});
});
