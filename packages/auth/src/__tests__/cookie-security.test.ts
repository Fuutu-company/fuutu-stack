import { describe, expect, it, vi } from "vitest";

/**
 * Regression test for the CI mobile-safari visual-test failure:
 * production builds (`pnpm start`) forced `Secure` on every Better-Auth
 * cookie while the E2E server runs on `http://localhost:3000`. Chromium
 * treats localhost as a secure context and sends Secure cookies anyway;
 * the Linux WebKit port behind Playwright's mobile-safari project does
 * NOT (WebKit's loopback exception is Cocoa-only) — so the session
 * cookie was dropped and every authenticated page rendered /auth/sign-in.
 *
 * `Secure` must follow the auth base URL's protocol, not NODE_ENV.
 */

vi.mock("@fuutu/env/saas", () => ({
	env: {
		BETTER_AUTH_URL: "http://localhost:3000",
		BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-12",
		CORS_ORIGIN: "http://localhost:3000",
		NODE_ENV: "production",
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

import { auth } from "../index";

describe("auth cookie attributes", () => {
	it("does not force Secure cookies when BETTER_AUTH_URL is http", () => {
		// The `secure` attribute must not be pinned — Better Auth derives it
		// (and the `__Secure-` prefix) from the baseURL protocol at runtime.
		const attrs: Record<string, unknown> =
			auth.options.advanced?.defaultCookieAttributes ?? {};
		expect("secure" in attrs && attrs.secure === true).toBe(false);
	});
});
