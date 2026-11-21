import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// Loads the full module inside a hook or test: slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * Better Auth options the kit's security depends on — checked on the real
 * `auth` instance, so a refactor of index.ts cannot silently drop them.
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
		FUUTU_DISABLE_RATE_LIMIT: true,
	},
}));

const listSoleOwnedOrganizations = vi.fn();
const getPurchasesByUserId = vi.fn();

vi.mock("@fuutu/db", () => ({
	getUserByEmail: vi.fn(),
	prismaAuditSink: vi.fn(),
	revokeOAuthTokensForUser: vi.fn(),
	claimUserCreatedEvent: vi.fn(),
	resetUserCreatedEvent: vi.fn(),
	countOrganizationMembers: vi.fn(),
	countOrganizationOwners: vi.fn(),
	adminSetOrganizationMemberRole: vi.fn(),
	getPurchasesByUserId: (...args: unknown[]) => getPurchasesByUserId(...args),
	listSoleOwnedOrganizations: (...args: unknown[]) =>
		listSoleOwnedOrganizations(...args),
	findPendingInvitation: vi.fn(),
	findPendingInvitationById: vi.fn(),
}));

vi.mock("@fuutu/db/internal/client", () => ({ db: {} }));

const cancelOrgOrThrow = vi.fn();

vi.mock("@fuutu/payments", () => ({
	createCustomerForUser: vi.fn(),
	CHARGEABLE_SUBSCRIPTION_STATUSES: ["ACTIVE", "TRIALING"],
	cancelAllSubscriptionsForOrganization: vi.fn(),
	cancelAllSubscriptionsForOrganizationOrThrow: (...args: unknown[]) =>
		cancelOrgOrThrow(...args),
	cancelSubscriptionNowOrThrow: vi.fn(),
	resolvePaymentProviderById: vi.fn(),
	updateSeatsInOrganizationSubscription: vi.fn(),
}));

const sendEmail = vi.fn();
vi.mock("../lib/email", () => ({
	sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

vi.mock("../hooks/audit", () => ({
	logSignUp: vi.fn(),
	logSessionCreated: vi.fn(),
}));

const IMPORT_TIMEOUT = 30_000;

type AuthModule = typeof import("../index");
let auth: AuthModule["auth"];

beforeAll(async () => {
	({ auth } = await import("../index"));
}, IMPORT_TIMEOUT);

beforeEach(() => {
	vi.clearAllMocks();
	listSoleOwnedOrganizations.mockResolvedValue([]);
	getPurchasesByUserId.mockResolvedValue([]);
	cancelOrgOrThrow.mockResolvedValue(undefined);
});

const post = (path: string, body: unknown) =>
	auth.handler(
		new Request(`http://localhost:3000/api/auth${path}`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: "http://localhost:3000",
			},
			body: JSON.stringify(body),
		}),
	);

/** Better Auth organization mutations the oRPC procedures wrap. */
const ORGANIZATION_MUTATIONS = [
	"/organization/create",
	"/organization/update",
	"/organization/delete",
	"/organization/invite-member",
	"/organization/update-member-role",
	"/organization/remove-member",
	"/organization/cancel-invitation",
];

describe("email change (H1)", () => {
	it("sends the confirmation link to the CURRENT address, not the new one", async () => {
		const changeEmail = auth.options.user?.changeEmail;
		await changeEmail?.sendChangeEmailConfirmation?.({
			user: { email: "old@fuutu.dev", name: "Ada" },
			newEmail: "attacker@evil.dev",
			url: "http://localhost:3000/api/auth/verify-email?token=t",
		});
		expect(sendEmail).toHaveBeenCalledTimes(1);
		expect(sendEmail).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "old@fuutu.dev",
				template: "email-change-verification",
			}),
		);
	});
});

describe("sessions", () => {
	it("revokes every session when the password is reset (H2)", () => {
		expect(auth.options.emailAndPassword?.revokeSessionsOnPasswordReset).toBe(
			true,
		);
	});

	it("caches sessions in the cookie for at most a minute (L3)", () => {
		const cache = auth.options.session?.cookieCache;
		expect(cache?.enabled ? (cache.maxAge ?? 300) : 0).toBeLessThanOrEqual(60);
	});
});

describe("client IP (M3)", () => {
	it("reads the client IP only from the kit-controlled header", async () => {
		const { CLIENT_IP_HEADER } = await import("../client-ip-header");
		expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([
			CLIENT_IP_HEADER,
		]);
	});
});

describe("account linking (L1)", () => {
	it("trusts no provider's email claim over its verification flag", () => {
		expect(auth.options.account?.accountLinking?.trustedProviders).toEqual([]);
	});
});

describe("plugins without UI (L4)", () => {
	it("registers neither username nor multi-session by default", () => {
		const ids = (auth.options.plugins ?? []).map((p) => p.id);
		expect(ids).not.toContain("username");
		expect(ids).not.toContain("multi-session");
	});
});

describe("profile input (L6)", () => {
	it.each([
		[
			"/sign-up/email",
			{ email: "a@b.dev", password: "ValidPassw0rd!", name: "x".repeat(101) },
		],
		[
			"/sign-up/email",
			{
				email: "a@b.dev",
				password: "ValidPassw0rd!",
				name: "A",
				image: "https://t.example/p.gif",
			},
		],
		["/update-user", { name: "x".repeat(101) }],
	])("rejects %s %#", async (path, body) => {
		const res = await post(path, body);
		expect(res.status).toBe(400);
		expect(await res.json()).toMatchObject({ code: "INVALID_PROFILE_INPUT" });
	});
});

describe("organization endpoints (orgs M1)", () => {
	it.each(ORGANIZATION_MUTATIONS)("closes %s to direct HTTP", async (path) => {
		expect(auth.options.disabledPaths).toContain(path);
		const res = await post(path, {});
		expect(res.status).toBe(404);
	});

	it("keeps the endpoints the UI calls directly open", () => {
		for (const path of [
			"/organization/accept-invitation",
			"/organization/set-active",
			"/organization/list",
			"/organization/get-full-organization",
			"/organization/check-slug",
			"/organization/leave",
		]) {
			expect(auth.options.disabledPaths).not.toContain(path);
		}
	});

	it("closes /organization/list-invitations (invitee emails; the UI uses the oRPC list)", async () => {
		expect(auth.options.disabledPaths).toContain(
			"/organization/list-invitations",
		);
		const res = await auth.handler(
			new Request(
				"http://localhost:3000/api/auth/organization/list-invitations?organizationId=org-1",
			),
		);
		expect(res.status).toBe(404);
		expect(auth.api.listInvitations).toBeTypeOf("function");
	});

	it("keeps server-side auth.api calls (oRPC procedures) working", () => {
		expect(auth.api.createOrganization).toBeTypeOf("function");
		expect(auth.api.updateMemberRole).toBeTypeOf("function");
	});
});

type OrgHooks = {
	beforeDeleteOrganization?: (input: {
		organization: { id: string };
	}) => Promise<void>;
};

describe("deletion guards (L2, payments L2)", () => {
	it("enables self-service account deletion", () => {
		expect(auth.options.user?.deleteUser?.enabled).toBe(true);
	});

	it("refuses to delete a sole organization owner", async () => {
		listSoleOwnedOrganizations.mockResolvedValue([
			{ id: "org-1", name: "Acme", slug: "acme" },
		]);
		const before = auth.options.databaseHooks?.user?.delete?.before;
		await expect(
			before?.({
				id: "u-1",
				email: "a@b.dev",
				name: "A",
				emailVerified: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			}),
		).rejects.toMatchObject({ statusCode: 409 });
	});

	it("aborts an organization delete whose subscription cannot be cancelled", async () => {
		cancelOrgOrThrow.mockRejectedValue(new Error("provider down"));
		const org = (auth.options.plugins ?? []).find(
			(p) => p.id === "organization",
		) as { options?: { organizationHooks?: OrgHooks } } | undefined;
		await expect(
			org?.options?.organizationHooks?.beforeDeleteOrganization?.({
				organization: { id: "org-1" },
			}),
		).rejects.toMatchObject({ statusCode: 502 });
	});
});

describe("authConfig.organizations.exposeAuthEndpoints", () => {
	it("is off by default", async () => {
		const { authConfig } = await import("../config");
		expect(authConfig.organizations.exposeAuthEndpoints).toBe(false);
	});

	describe("when opted in", () => {
		let exposed: AuthModule["auth"];

		beforeAll(async () => {
			vi.resetModules();
			vi.doMock("../config", async (importOriginal) => {
				const actual = await importOriginal<typeof import("../config")>();
				return {
					...actual,
					authConfig: {
						...actual.authConfig,
						organizations: {
							...actual.authConfig.organizations,
							exposeAuthEndpoints: true,
						},
					},
				};
			});
			({ auth: exposed } = await import("../index"));
		}, IMPORT_TIMEOUT);

		afterAll(() => {
			vi.doUnmock("../config");
			vi.resetModules();
		});

		it("leaves the organization endpoints out of disabledPaths", () => {
			for (const path of ORGANIZATION_MUTATIONS) {
				expect(exposed.options.disabledPaths).not.toContain(path);
			}
		});
	});
});
