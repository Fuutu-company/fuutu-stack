import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `authConfig.organizations.organizationLimit` — the most organizations a
 * user may belong to and still create another one (Better Auth
 * `organizationLimit`). Unset keeps Better Auth's default: no cap.
 */

const state = vi.hoisted(() => ({
	override: null as { organizationLimit: number | undefined } | null,
}));

vi.mock("../config", async (importOriginal) => {
	const { authConfig } = await importOriginal<typeof import("../config")>();
	return {
		authConfig: {
			...authConfig,
			get organizations() {
				return { ...authConfig.organizations, ...state.override };
			},
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

async function organizationLimit(): Promise<unknown> {
	const { auth } = await import("../index");
	const plugin = auth.options.plugins?.find((p) => p.id === "organization") as
		| { options?: { organizationLimit?: unknown } }
		| undefined;
	expect(plugin).toBeDefined();
	return plugin?.options?.organizationLimit;
}

beforeEach(() => {
	vi.resetModules();
	state.override = null;
});

describe("organizations per user", () => {
	it("sets no cap while unset (the kit default)", async () => {
		state.override = { organizationLimit: undefined };
		expect(await organizationLimit()).toBeUndefined();
	});

	it("passes the configured cap to the organization plugin", async () => {
		state.override = { organizationLimit: 20 };
		expect(await organizationLimit()).toBe(20);
	});

	it("uses the app's authConfig value as is", async () => {
		const { authConfig } = await import("../config");
		expect(await organizationLimit()).toBe(
			authConfig.organizations.organizationLimit,
		);
	});
});
