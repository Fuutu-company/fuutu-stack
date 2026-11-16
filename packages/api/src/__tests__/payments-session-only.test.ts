import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

/**
 * Money moves only from a signed-in session: an API key (personal, or org
 * key on its own org) authenticates as its owner on oRPC, so without this
 * a leaked key could open the billing portal, start checkouts, or cancel
 * and resume the owner's subscriptions. Every payment mutation refuses
 * the key before anything reaches the provider.
 */

vi.mock("@fuutu/payments/config", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/payments/config")>()),
	...(await import("@fuutu/test-utils")).planCatalogFixture,
}));

const provider = vi.hoisted(() => ({
	id: "polar",
	createCheckoutLink: vi.fn(),
	createCustomerPortalLink: vi.fn(),
	cancelSubscription: vi.fn(),
	resumeSubscription: vi.fn(),
	webhookHandler: vi.fn(),
}));

vi.mock("@fuutu/payments", () => ({
	assertCheckoutAllowed: vi.fn().mockResolvedValue({ trial: false }),
	CheckoutRejectedError: class CheckoutRejectedError extends Error {},
	getPlanSubscription: vi.fn().mockResolvedValue({ customerId: "cus_1" }),
	resolvePaymentProvider: () => provider,
	isPaymentsEnabled: () => true,
	PaymentsDisabledError: class PaymentsDisabledError extends Error {},
	WebhookConfigError: class WebhookConfigError extends Error {},
	isProviderRequestError: () => false,
	CREDIT_TOPUPS: [
		{
			id: "ai_tokens_100k",
			meterKey: "ai_tokens",
			amount: 100_000,
			displayPrice: "$10",
			priceIdEnvVar: "CREDITS_AI_TOKENS_100K_PRICE_ID",
		},
	],
}));

vi.mock("@fuutu/payments/config.server", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/payments/config.server")>()),
	getPlanPriceId: () => "price-1",
	getPlanNoTrialPriceId: () => "price-1",
	getCreditTopupPriceId: () => "price-topup-1",
}));

const ORG_ID = "12345678-1234-1234-8123-123456789abc";

vi.mock("@fuutu/db", () => ({
	getOrganizationById: vi.fn().mockResolvedValue({
		id: "12345678-1234-1234-8123-123456789abc",
		paymentsCustomerId: "cus_org",
	}),
	getOrganizationWithMembers: vi.fn().mockResolvedValue({
		id: "12345678-1234-1234-8123-123456789abc",
		name: "Acme",
		slug: "acme",
		members: [
			{
				id: "member-1",
				userId: "user-1",
				role: "owner",
				user: { email: "owner@fuutu.local" },
			},
		],
	}),
	getPurchaseByProviderSubscriptionId: vi.fn().mockResolvedValue({
		userId: "user-1",
		organizationId: null,
		status: "ACTIVE",
		currentPeriodEnd: null,
	}),
	getMemberRole: vi.fn().mockResolvedValue("owner"),
}));

vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

const { paymentsConfig } = await import("@fuutu/payments/config");
paymentsConfig.creditsEnabled = true;
const { paymentsRouter } = await import("../modules/payments/router");

const user = makeUser({ id: "user-1" });
const personalKey = {
	...makeSession<Context>(user),
	apiKey: { id: "key-personal", organizationId: null },
} satisfies Context;
const orgKey = {
	...makeSession<Context>(user),
	apiKey: { id: "key-org", organizationId: ORG_ID },
} satisfies Context;

const KEY_REFUSED = {
	code: "FORBIDDEN",
	message: "API keys cannot perform this action",
};

beforeEach(() => {
	vi.clearAllMocks();
});

function expectProviderUntouched() {
	expect(provider.createCheckoutLink).not.toHaveBeenCalled();
	expect(provider.createCustomerPortalLink).not.toHaveBeenCalled();
	expect(provider.cancelSubscription).not.toHaveBeenCalled();
	expect(provider.resumeSubscription).not.toHaveBeenCalled();
}

describe("payment mutations refuse API keys", () => {
	it.each([
		[
			"checkout.create",
			() => paymentsRouter.checkout.create,
			{ planId: "pro" },
		],
		[
			"topupCheckout.create",
			() => paymentsRouter.topupCheckout.create,
			{ topupId: "ai_tokens_100k" },
		],
		["portal.open", () => paymentsRouter.portal.open, {}],
		[
			"subscription.cancel",
			() => paymentsRouter.subscription.cancel,
			{ subscriptionId: "sub_1" },
		],
		[
			"subscription.resume",
			() => paymentsRouter.subscription.resume,
			{ subscriptionId: "sub_1" },
		],
	] as const)("%s with a personal key", async (_name, procedure, input) => {
		await expect(
			call(procedure() as never, input as never, { context: personalKey }),
		).rejects.toMatchObject(KEY_REFUSED);
		expectProviderUntouched();
	});

	it.each([
		[
			"checkout.create",
			() => paymentsRouter.checkout.create,
			{ planId: "pro", organizationId: ORG_ID },
		],
		[
			"topupCheckout.create",
			() => paymentsRouter.topupCheckout.create,
			{ topupId: "ai_tokens_100k", organizationId: ORG_ID },
		],
		[
			"portal.open",
			() => paymentsRouter.portal.open,
			{ organizationId: ORG_ID },
		],
	] as const)(
		"%s with an org key on its own org",
		async (_name, procedure, input) => {
			await expect(
				call(procedure() as never, input as never, { context: orgKey }),
			).rejects.toMatchObject(KEY_REFUSED);
			expectProviderUntouched();
		},
	);
});
