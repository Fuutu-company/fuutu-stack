import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The org plugin sends invitations through the shared
 * `sendOrganizationInvitationEmail` (same payload as before the move) and
 * takes the invitation lifetime from authConfig.
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
	getPurchasesByUserId: vi.fn(),
	findPendingInvitation: vi.fn(),
	findPendingInvitationById: vi.fn(),
}));

vi.mock("@fuutu/db/internal/client", () => ({ db: {} }));

vi.mock("@fuutu/payments", () => ({
	createCustomerForUser: vi.fn(),
}));

vi.mock("../lib/email", () => ({ sendEmail: vi.fn() }));

vi.mock("../lib/invitation-email", () => ({
	sendOrganizationInvitationEmail: vi.fn(),
}));

const IMPORT_TIMEOUT = 30_000;

type OrgPluginOptions = {
	invitationExpiresIn?: unknown;
	sendInvitationEmail?: (data: unknown) => Promise<void>;
};

let options: OrgPluginOptions | undefined;

beforeAll(async () => {
	const { auth } = await import("../index");
	const plugin = auth.options.plugins?.find((p) => p.id === "organization") as
		| { options?: OrgPluginOptions }
		| undefined;
	options = plugin?.options;
}, IMPORT_TIMEOUT);

describe("organization plugin invitations", () => {
	it("sends through the shared invitation email with the inviter's name and locale", async () => {
		const { sendOrganizationInvitationEmail } = await import(
			"../lib/invitation-email"
		);
		await options?.sendInvitationEmail?.({
			id: "inv-1",
			role: "member",
			email: "new@acme.test",
			organization: { id: "org-1", name: "Acme", slug: "acme" },
			inviter: {
				id: "mem-1",
				role: "owner",
				user: { id: "user-1", name: "Grace", locale: "de" },
			},
			invitation: {},
		});
		expect(sendOrganizationInvitationEmail).toHaveBeenCalledWith({
			email: "new@acme.test",
			invitationId: "inv-1",
			organizationName: "Acme",
			inviterName: "Grace",
			locale: "de",
		});
	});

	it("keeps invitations valid for authConfig.organizations.invitationExpiresIn (48 h)", async () => {
		const { authConfig } = await import("../config");
		expect(options?.invitationExpiresIn).toBe(
			authConfig.organizations.invitationExpiresIn,
		);
		// Better Auth's default — the explicit value changes nothing.
		expect(authConfig.organizations.invitationExpiresIn).toBe(48 * 60 * 60);
	});
});
