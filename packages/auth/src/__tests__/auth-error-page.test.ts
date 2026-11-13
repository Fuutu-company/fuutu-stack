import { describe, expect, it, vi } from "vitest";

/**
 * Regression: in production builds Better Auth's default `/api/auth/error`
 * redirects to `/?error=…` — the app root then sends signed-in users to the
 * dashboard, so every auth/OAuth error (failed social sign-in, rejected
 * MCP authorize) vanished without a message. Errors must land on the app's
 * own error page.
 */

vi.mock("@fuutu/env/saas", () => ({
	env: {
		BETTER_AUTH_URL: "http://localhost:3000",
		BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-12",
		CORS_ORIGIN: "http://localhost:3000",
		NODE_ENV: "production",
		NEXT_PUBLIC_SAAS_URL: undefined,
		FUUTU_DISABLE_RATE_LIMIT: true,
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

import { auth } from "../index";

describe("auth error page", () => {
	it("points Better Auth errors at the app's /auth/error page", () => {
		expect(auth.options.onAPIError?.errorURL).toBe(
			"http://localhost:3000/auth/error",
		);
	});

	it("redirects /api/auth/error there in production instead of to the app root", async () => {
		const res = await auth.handler(
			new Request("http://localhost:3000/api/auth/error?error=access_denied"),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("location")).toBe(
			"http://localhost:3000/auth/error?error=access_denied",
		);
	});
});
