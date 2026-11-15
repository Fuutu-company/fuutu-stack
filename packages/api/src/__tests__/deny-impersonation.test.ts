import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const { createApiKeyProcedure } = await import(
	"../modules/api-keys/procedures/create"
);
const { createCheckout } = await import(
	"../modules/payments/procedures/create-checkout"
);
const { createBillingPortal } = await import(
	"../modules/payments/procedures/create-billing-portal"
);
const { cancelSubscription } = await import(
	"../modules/payments/procedures/cancel-subscription"
);
const { resumeSubscription } = await import(
	"../modules/payments/procedures/resume-subscription"
);
const { createTopupCheckout } = await import(
	"../modules/payments/procedures/create-topup-checkout"
);
const { deleteOrganization } = await import(
	"../modules/organizations/procedures/delete"
);
const { inviteMember } = await import(
	"../modules/organizations/members/procedures/invite"
);
const { updateOrganization } = await import(
	"../modules/organizations/procedures/update"
);
const { removeMember } = await import(
	"../modules/organizations/members/procedures/remove"
);
const { updateMemberRole } = await import(
	"../modules/organizations/members/procedures/update-role"
);
const { revokeInvitation } = await import(
	"../modules/organizations/invitations/procedures/revoke"
);
const { deleteWebhookProcedure } = await import(
	"../modules/webhooks/procedures/delete"
);
const { revokeApiKeyProcedure } = await import(
	"../modules/api-keys/procedures/revoke"
);
const { deleteApiKeyProcedure } = await import(
	"../modules/api-keys/procedures/delete"
);
const { createWebhookProcedure } = await import(
	"../modules/webhooks/procedures/create"
);
const { updateWebhookProcedure } = await import(
	"../modules/webhooks/procedures/update"
);
const { updateUserProfile } = await import(
	"../modules/users/procedures/update-user-profile"
);

/**
 * Support may look around as the user, but never spend their money, mint
 * or revoke credentials, change who is in an organization or with which
 * role, rename it, touch its webhooks or delete it. Leaving an organization and
 * account/credential changes are blocked in Better Auth's hooks.before
 * (@fuutu/auth hooks/impersonation-guard).
 */
const DENIED = [
	["apiKeys.create", createApiKeyProcedure, { name: "CI" }],
	["apiKeys.revoke", revokeApiKeyProcedure, { id: "key-1" }],
	["apiKeys.delete", deleteApiKeyProcedure, { id: "key-1" }],
	["payments.checkout.create", createCheckout, { planId: "pro" }],
	["payments.portal.open", createBillingPortal, {}],
	["payments.subscription.cancel", cancelSubscription, { subscriptionId: "s" }],
	["payments.subscription.resume", resumeSubscription, { subscriptionId: "s" }],
	["payments.topupCheckout.create", createTopupCheckout, { topupId: "t" }],
	["organizations.delete", deleteOrganization, { organizationId: "org-1" }],
	[
		"organizations.update",
		updateOrganization,
		{ organizationId: "org-1", name: "Renamed" },
	],
	[
		"organizations.members.remove",
		removeMember,
		{ organizationId: "org-1", memberIdOrEmail: "member-1" },
	],
	[
		"organizations.members.updateRole",
		updateMemberRole,
		{ organizationId: "org-1", memberId: "member-1", role: "admin" },
	],
	[
		"organizations.invitations.revoke",
		revokeInvitation,
		{ invitationId: "inv-1" },
	],
	[
		"organizations.members.invite",
		inviteMember,
		{ organizationId: "org-1", email: "new@fuutu.local" },
	],
	[
		"webhooks.create",
		createWebhookProcedure,
		{
			organizationId: "org-1",
			url: "https://example.com/hook",
			events: ["member.removed"],
		},
	],
	[
		"webhooks.delete",
		deleteWebhookProcedure,
		{ id: "wh-1", organizationId: "org-1" },
	],
	[
		"webhooks.update",
		updateWebhookProcedure,
		{ id: "wh-1", organizationId: "org-1", url: "https://example.com/hook" },
	],
	["users.updateProfile", updateUserProfile, { name: "Renamed" }],
] as const;

function impersonatedContext(): Context {
	const ctx = makeSession<Context>(makeUser({ id: "user-2" }));
	(ctx.session?.session as { impersonatedBy?: string }).impersonatedBy =
		"admin-1";
	return ctx;
}

describe.each(DENIED)("%s while impersonating", (_name, procedure, input) => {
	it("is rejected with 403 before any side effect", async () => {
		await expect(
			call(procedure as never, input as never, {
				context: impersonatedContext(),
			}),
		).rejects.toMatchObject({
			code: "FORBIDDEN",
			message: "Not allowed while impersonating a user",
		});
	});
});
