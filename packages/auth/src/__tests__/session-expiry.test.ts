import { describe, expect, it, vi } from "vitest";

// Loads the full module inside a hook or test: slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * Session lifetime — `authConfig.session` is what the privacy policy
 * documents (session cookie lifetime), so the default must only change
 * on purpose, and the Better Auth instance must use the config value.
 */

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

const DAY = 24 * 60 * 60;
/** A fresh import of the auth instance is slow under a parallel `pnpm test`. */
const IMPORT_TIMEOUT = 30_000;

describe("session expiry", () => {
	// The cookie cache serves a session without a database check — a
	// revoked session or a ban only takes effect once it expires, so it
	// stays short (1 minute).
	it("defaults to 30 days, refreshed once a day, cookie cache 1 minute", async () => {
		const { authConfig } = await import("../config");
		expect(authConfig.session.expiresIn).toBe(2_592_000);
		expect(authConfig.session.updateAge).toBe(86_400);
		expect(authConfig.session.cookieCache.maxAge).toBe(60);
	});

	/** The Better Auth instance built from `authConfig` with these session values. */
	async function authWithSession(session: {
		expiresIn: number;
		updateAge: number;
	}) {
		vi.resetModules();
		const actual =
			await vi.importActual<typeof import("../config")>("../config");
		vi.doMock("../config", () => ({
			...actual,
			authConfig: {
				...actual.authConfig,
				session: { ...actual.authConfig.session, ...session },
			},
		}));
		const { auth } = await import("../index");
		vi.doUnmock("../config");
		return auth;
	}

	it(
		"passes authConfig.session to Better Auth",
		async () => {
			const auth = await authWithSession({
				expiresIn: 7 * DAY,
				updateAge: DAY / 2,
			});
			expect(auth.options.session?.expiresIn).toBe(604_800);
			expect(auth.options.session?.updateAge).toBe(43_200);
		},
		IMPORT_TIMEOUT,
	);

	it(
		"sets the session cookie's max-age from the session expiry",
		async () => {
			const auth = await authWithSession({
				expiresIn: 14 * DAY,
				updateAge: DAY,
			});
			const ctx = await auth.$context;
			expect(ctx.authCookies.sessionToken.attributes.maxAge).toBe(1_209_600);
		},
		IMPORT_TIMEOUT,
	);
});
