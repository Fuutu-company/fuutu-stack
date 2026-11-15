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

/**
 * Support may look around as the user, but never spend their money, mint
 * credentials or delete their organization. Leaving an organization and
 * account/credential changes are blocked in Better Auth's hooks.before
 * (@fuutu/auth hooks/impersonation-guard).
 */
const DENIED = [
	["apiKeys.create", createApiKeyProcedure, { name: "CI" }],
	["payments.checkout.create", createCheckout, { planId: "pro" }],
	["payments.portal.open", createBillingPortal, {}],
	["payments.subscription.cancel", cancelSubscription, { subscriptionId: "s" }],
	["payments.subscription.resume", resumeSubscription, { subscriptionId: "s" }],
	["payments.topupCheckout.create", createTopupCheckout, { topupId: "t" }],
	["organizations.delete", deleteOrganization, { organizationId: "org-1" }],
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
