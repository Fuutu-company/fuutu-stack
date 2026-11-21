import { describe, expect, it, vi } from "vitest";

// Loads the full module inside a hook or test: slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * Accepting, rejecting or reading an invitation by id needs a verified
 * session email (Better Auth `requireEmailVerificationOnInvitation`).
 * Without it, anyone who signs up with an invited address — unverified —
 * could accept the invitation and its role.
 */

// The organization plugin's wiring is under test: organizations on,
// whatever the app's organizationsMode (a B2C app sets "off").
vi.mock("@fuutu/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/config")>();
	return {
		...actual,
		config: {
			...actual.config,
			features: { ...actual.config.features, organizationsMode: "on" },
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

describe("organization invitations", () => {
	it("require a verified email to accept, reject or read one by id", async () => {
		const { auth } = await import("../index");
		const plugin = auth.options.plugins?.find((p) => p.id === "organization") as
			| { options?: { requireEmailVerificationOnInvitation?: unknown } }
			| undefined;
		expect(plugin).toBeDefined();
		expect(plugin?.options?.requireEmailVerificationOnInvitation).toBe(true);
	});
});
