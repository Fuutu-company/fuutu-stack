import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Loads the full module inside a hook or test: slow on a busy machine.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * The security policies reach the real `auth` instance through
 * `security/index.ts`: every request guard runs, in its order, and the
 * organization plugin keeps the last-owner and API-key revocation hooks.
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

vi.mock("@fuutu/db", () => ({
	getUserByEmail: vi.fn(),
	prismaAuditSink: vi.fn(),
	revokeOAuthTokensForUser: vi.fn(),
	claimUserCreatedEvent: vi.fn(),
	resetUserCreatedEvent: vi.fn(),
	countOrganizationMembers: vi.fn(),
	countOrganizationOwners: vi.fn(),
	adminSetOrganizationMemberRole: vi.fn(),
	getPurchasesByUserId: vi.fn(),
	listSoleOwnedOrganizations: vi.fn(),
	findPendingInvitation: vi.fn(),
	findPendingInvitationById: vi.fn(),
}));

vi.mock("@fuutu/db/internal/client", () => ({ db: {} }));

vi.mock("@fuutu/payments", () => ({
	createCustomerForUser: vi.fn(),
	CHARGEABLE_SUBSCRIPTION_STATUSES: ["ACTIVE", "TRIALING"],
	cancelAllSubscriptionsForOrganization: vi.fn(),
	cancelAllSubscriptionsForOrganizationOrThrow: vi.fn(),
	cancelSubscriptionNowOrThrow: vi.fn(),
	resolvePaymentProviderById: vi.fn(),
	updateSeatsInOrganizationSubscription: vi.fn(),
}));

vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));

vi.mock("../hooks/audit", () => ({
	logSignUp: vi.fn(),
	logSessionCreated: vi.fn(),
	logApiKeysRevoked: vi.fn(),
}));

const calls = vi.hoisted(() => [] as string[]);
const guard = (name: string) => async () => {
	calls.push(name);
};

vi.mock("../hooks/password-policy", () => ({
	assertPasswordPolicy: () => {
		calls.push("password-policy");
	},
}));
vi.mock("../hooks/impersonation-guard", () => ({
	assertNotImpersonating: guard("impersonation-guard"),
}));
vi.mock("../hooks/profile-input", () => ({
	assertProfileInput: guard("profile-input"),
}));
vi.mock("../hooks/fresh-session", () => ({
	assertFreshSession: guard("fresh-session"),
}));
vi.mock("../hooks/verified-email-change", () => ({
	assertVerifiedEmailForChange: guard("verified-email-change"),
}));
vi.mock("../hooks/verified-email-credentials", () => ({
	assertVerifiedEmailForCredential: guard("verified-email-credentials"),
}));
vi.mock("../hooks/email-verification-session", () => ({
	assertSessionForEmailVerification: guard("email-verification-session"),
}));
vi.mock("../hooks/delete-user-reauth", () => ({
	assertDeleteUserReauth: guard("delete-user-reauth"),
}));
vi.mock("../hooks/impersonation-session", () => ({
	assertImpersonationActive: guard("impersonation-session"),
	isEndedImpersonationResult: vi.fn(async () => false),
}));
vi.mock("../hooks/last-owner", () => ({
	assertOwnerRemainsAfterRemoval: guard("last-owner:remove"),
	assertOwnerRemainsAfterRoleChange: guard("last-owner:role"),
	restoreOwnerIfNoneLeft: guard("last-owner:restore"),
}));
vi.mock("../hooks/member-api-keys", () => ({
	revokeApiKeysOfRemovedMember: guard("member-api-keys:remove"),
	revokeApiKeysAfterLeave: vi.fn(),
}));

const IMPORT_TIMEOUT = 30_000;

type AuthModule = typeof import("../index");
let auth: AuthModule["auth"];

beforeAll(async () => {
	({ auth } = await import("../index"));
}, IMPORT_TIMEOUT);

beforeEach(() => {
	calls.length = 0;
});

type MemberHook = (input: Record<string, unknown>) => Promise<void>;
type OrgHooks = Record<
	"beforeRemoveMember" | "beforeUpdateMemberRole" | "afterUpdateMemberRole",
	MemberHook | undefined
>;

const organizationHooks = () =>
	(
		(auth.options.plugins ?? []).find((p) => p.id === "organization") as
			| { options?: { organizationHooks?: OrgHooks } }
			| undefined
	)?.options?.organizationHooks;

describe("hooks.before", () => {
	it("runs every request guard, in order", async () => {
		await auth.options.hooks?.before?.({
			path: "/change-email",
			body: {},
			query: {},
			headers: new Headers(),
			context: { secret: "secret", internalAdapter: {} },
		} as never);
		expect(calls).toEqual([
			"password-policy",
			"impersonation-guard",
			"profile-input",
			"fresh-session",
			"verified-email-change",
			"verified-email-credentials",
			"email-verification-session",
			"delete-user-reauth",
			"impersonation-session",
		]);
	});
});

describe("organizationHooks", () => {
	const member = { id: "m-1", userId: "u-1", organizationId: "org-1" };

	it("keeps an owner and revokes the member's API keys before a removal", async () => {
		await organizationHooks()?.beforeRemoveMember?.({ member });
		expect(calls).toEqual(["last-owner:remove", "member-api-keys:remove"]);
	});

	it("keeps an owner around a role change", async () => {
		await organizationHooks()?.beforeUpdateMemberRole?.({
			member,
			newRole: "member",
		});
		await organizationHooks()?.afterUpdateMemberRole?.({
			member,
			previousRole: "owner",
		});
		expect(calls).toEqual(["last-owner:role", "last-owner:restore"]);
	});
});
