import { describe, expect, it, vi } from "vitest";

/** The kit's Better Auth instance mounts the read-only rate limit rules. */

vi.mock("@fuutu/env/saas", () => ({
	env: {
		BETTER_AUTH_URL: "http://localhost:3000",
		BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-12",
		CORS_ORIGIN: "http://localhost:3000",
		NODE_ENV: "test",
		NEXT_PUBLIC_SAAS_URL: undefined,
		FUUTU_DISABLE_RATE_LIMIT: false,
	},
}));

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

vi.mock("@fuutu/payments", () => ({
	createCustomerForUser: vi.fn(),
}));

vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));

describe("auth rate limit", () => {
	it("uses the read-only rules for the session, org list and full-org reads", async () => {
		const { auth } = await import("../index");
		const rules = auth.options.rateLimit?.customRules ?? {};
		expect(Object.keys(rules).sort()).toEqual([
			"/get-session",
			"/organization/get-full-organization",
			"/organization/list",
		]);
		const rule = rules["/get-session"];
		expect(typeof rule).toBe("function");
		if (typeof rule !== "function") return;
		expect(
			await rule(new Request("http://localhost:3000/api/auth/get-session"), {
				window: 60,
				max: 100,
			}),
		).toBe(false);
	});
});
