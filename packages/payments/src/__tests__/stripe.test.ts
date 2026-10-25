import { env } from "@fuutu/env/saas";
import { describe, expect, it, vi } from "vitest";
import { WebhookConfigError, WebhookSignatureError } from "../types";

const checkoutCreate = vi
	.fn()
	.mockResolvedValue({ url: "https://checkout.test/url" });
const portalCreate = vi.fn().mockResolvedValue({
	url: "https://portal.test/url",
});
const subscriptionsCancel = vi.fn().mockResolvedValue(undefined);
const customersCreate = vi.fn().mockResolvedValue({ id: "cust_stripe_123" });
const subscriptionsRetrieve = vi.fn().mockResolvedValue({
	items: { data: [{ id: "item_123" }] },
});
const subscriptionsUpdate = vi.fn().mockResolvedValue(undefined);
const webhooksConstructEventAsync = vi.fn().mockResolvedValue({
	type: "customer.subscription.created",
	data: {
		object: {
			id: "sub_123",
			customer: "cust_123",
			items: {
				data: [{ price: { id: "price_123" }, current_period_end: 1234567890 }],
			},
			status: "active",
			metadata: {},
		},
	},
});
const listLineItems = vi.fn().mockResolvedValue({
	data: [{ price: { id: "price_topup" } }],
});

// Mirrors the real Stripe SDK contract: signature verification failures
// surface as `Stripe.errors.StripeSignatureVerificationError`, not as a
// generic Error with "signature" in the message.
const MockStripeSignatureVerificationError = vi.hoisted(
	() =>
		class StripeSignatureVerificationError extends Error {
			header: unknown;
			payload: unknown;
			constructor(header?: unknown, payload?: unknown, message?: string) {
				super(message ?? "signature verification failed");
				this.name = "StripeSignatureVerificationError";
				this.header = header;
				this.payload = payload;
			}
		},
);

vi.mock("stripe", () => ({
	default: class MockStripe {
		static errors = {
			StripeSignatureVerificationError: MockStripeSignatureVerificationError,
		};
		checkout = { sessions: { create: checkoutCreate, listLineItems } };
		billingPortal = { sessions: { create: portalCreate } };
		customers = { create: customersCreate };
		subscriptions = {
			cancel: subscriptionsCancel,
			retrieve: subscriptionsRetrieve,
			update: subscriptionsUpdate,
		};
		webhooks = { constructEventAsync: webhooksConstructEventAsync };
	},
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		STRIPE_SECRET_KEY: "test-stripe-key",
		STRIPE_WEBHOOK_SECRET: "test-webhook-secret",
		NEXT_PUBLIC_SAAS_URL: "https://app.test",
		NODE_ENV: "test",
	},
}));

const { stripePaymentProvider } = await import("../providers/stripe");

describe("stripe provider — SDK integration", () => {
	it("createCheckoutLink calls Stripe checkout.sessions.create and returns the url", async () => {
		checkoutCreate.mockClear();
		const result = await stripePaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
		});
		expect(result.url).toBe("https://checkout.test/url");
		expect(checkoutCreate).toHaveBeenCalledOnce();
	});

	it("createCheckoutLink defaults success/cancel URL to the SaaS app URL", async () => {
		checkoutCreate.mockClear();
		await stripePaymentProvider.createCheckoutLink({ priceId: "price_abc" });
		const params = checkoutCreate.mock.calls[0]?.[0];
		expect(params.success_url).toBe("https://app.test");
		expect(params.cancel_url).toBe("https://app.test");
	});

	it("createCheckoutLink prefers explicit URLs over the default", async () => {
		checkoutCreate.mockClear();
		await stripePaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			successUrl: "https://custom.test/done",
			cancelUrl: "https://custom.test/back",
		});
		const params = checkoutCreate.mock.calls[0]?.[0];
		expect(params.success_url).toBe("https://custom.test/done");
		expect(params.cancel_url).toBe("https://custom.test/back");
	});

	it("createCheckoutLink throws WebhookConfigError when no URL fallback is configured", async () => {
		const original = env.NEXT_PUBLIC_SAAS_URL;
		Object.assign(env, { NEXT_PUBLIC_SAAS_URL: undefined });
		checkoutCreate.mockClear();
		try {
			const err = await stripePaymentProvider
				.createCheckoutLink({ priceId: "price_abc" })
				.catch((e: unknown) => e);
			expect(err).toBeInstanceOf(WebhookConfigError);
			expect(checkoutCreate).not.toHaveBeenCalled();
		} finally {
			Object.assign(env, { NEXT_PUBLIC_SAAS_URL: original });
		}
	});

	it("createCheckoutLink throws WebhookConfigError on a relative success URL", async () => {
		checkoutCreate.mockClear();
		const err = await stripePaymentProvider
			.createCheckoutLink({ priceId: "price_abc", successUrl: "/done" })
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(WebhookConfigError);
		expect(checkoutCreate).not.toHaveBeenCalled();
	});

	it("createCheckoutLink mirrors owner metadata into subscription_data.metadata", async () => {
		checkoutCreate.mockClear();
		await stripePaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
			organizationId: "org_123",
			metadata: { plan: "pro" },
		});
		const params = checkoutCreate.mock.calls[0]?.[0];
		expect(params.subscription_data?.metadata).toMatchObject({
			user_id: "user_123",
			organization_id: "org_123",
			plan: "pro",
		});
	});

	it("createCheckoutLink keeps owner metadata authoritative over input.metadata", async () => {
		checkoutCreate.mockClear();
		await stripePaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
			organizationId: "org_123",
			metadata: {
				user_id: "attacker_user",
				organization_id: "attacker_org",
				extra: "kept",
			},
		});
		const params = checkoutCreate.mock.calls[0]?.[0];
		expect(params.metadata).toMatchObject({
			user_id: "user_123",
			organization_id: "org_123",
			extra: "kept",
		});
	});

	it("createCustomer keeps fuutu_user_id authoritative over input.metadata", async () => {
		customersCreate.mockClear();
		await stripePaymentProvider.createCustomer({
			userId: "user_123",
			email: "test@test.com",
			metadata: { fuutu_user_id: "attacker_user" },
		});
		const params = customersCreate.mock.calls[0]?.[0];
		expect(params.metadata.fuutu_user_id).toBe("user_123");
	});

	it("createCustomerPortalLink calls billingPortal.sessions.create and returns the url", async () => {
		portalCreate.mockClear();
		const result = await stripePaymentProvider.createCustomerPortalLink({
			customerId: "cust_123",
		});
		expect(result.url).toBe("https://portal.test/url");
		expect(portalCreate).toHaveBeenCalledOnce();
	});

	it("createCustomer calls customers.create and returns the id", async () => {
		customersCreate.mockClear();
		const result = await stripePaymentProvider.createCustomer({
			userId: "user_123",
			email: "test@test.com",
		});
		expect(result.customerId).toBe("cust_stripe_123");
		expect(customersCreate).toHaveBeenCalledOnce();
	});

	it("cancelSubscription calls subscriptions.cancel", async () => {
		subscriptionsCancel.mockClear();
		await stripePaymentProvider.cancelSubscription("sub_123");
		expect(subscriptionsCancel).toHaveBeenCalledOnce();
	});

	it("createCustomerPortalLink defaults return_url to the SaaS app URL", async () => {
		portalCreate.mockClear();
		await stripePaymentProvider.createCustomerPortalLink({
			customerId: "cust_123",
		});
		const params = portalCreate.mock.calls[0]?.[0];
		expect(params.return_url).toBe("https://app.test");
	});

	it("createCustomerPortalLink prefers an explicit returnUrl", async () => {
		portalCreate.mockClear();
		await stripePaymentProvider.createCustomerPortalLink({
			customerId: "cust_123",
			returnUrl: "https://custom.test/settings",
		});
		const params = portalCreate.mock.calls[0]?.[0];
		expect(params.return_url).toBe("https://custom.test/settings");
	});

	it("createCustomerPortalLink throws WebhookConfigError when no return URL is available", async () => {
		const original = env.NEXT_PUBLIC_SAAS_URL;
		Object.assign(env, { NEXT_PUBLIC_SAAS_URL: undefined });
		portalCreate.mockClear();
		try {
			const err = await stripePaymentProvider
				.createCustomerPortalLink({ customerId: "cust_123" })
				.catch((e: unknown) => e);
			expect(err).toBeInstanceOf(WebhookConfigError);
			expect(portalCreate).not.toHaveBeenCalled();
		} finally {
			Object.assign(env, { NEXT_PUBLIC_SAAS_URL: original });
		}
	});

	it("ownsSeatSync is false (we manage seats, not Stripe)", () => {
		expect(stripePaymentProvider.ownsSeatSync).toBe(false);
	});

	it("parseWebhook returns ProviderEvent[] on a valid signature", async () => {
		webhooksConstructEventAsync.mockClear();
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"stripe-signature": "test",
			},
			body: "{}",
		});
		const events = await stripePaymentProvider.parseWebhook(request);
		expect(Array.isArray(events)).toBe(true);
		expect(events.length).toBe(1);
		expect(events[0]?.type).toBe("subscription.activated");
		expect(events[0]?.subscriptionId).toBe("sub_123");
	});

	it("parseWebhook throws WebhookSignatureError on missing signature", async () => {
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			body: "{}",
		});
		const err = await stripePaymentProvider
			.parseWebhook(request)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(WebhookSignatureError);
		expect((err as Error).message).toContain("signature");
	});

	it("parseWebhook throws WebhookSignatureError on invalid signature", async () => {
		webhooksConstructEventAsync.mockImplementationOnce(() => {
			throw new MockStripeSignatureVerificationError(
				"sig_header",
				"payload",
				"No signatures found matching the expected signature for payload",
			);
		});
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"stripe-signature": "bad",
			},
			body: "{}",
		});
		const err = await stripePaymentProvider
			.parseWebhook(request)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(WebhookSignatureError);
		expect((err as Error).message).toContain("signature");
	});

	it("parseWebhook rethrows errors that merely mention 'signature' in the message", async () => {
		webhooksConstructEventAsync.mockImplementationOnce(() => {
			throw new Error("signature scheme deprecated upstream");
		});
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "stripe-signature": "test" },
			body: "{}",
		});
		const err = await stripePaymentProvider
			.parseWebhook(request)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(Error);
		expect(err).not.toBeInstanceOf(WebhookSignatureError);
		expect((err as Error).message).toBe("signature scheme deprecated upstream");
	});

	it("parseWebhook throws WebhookConfigError when the webhook secret is not configured", async () => {
		const original = env.STRIPE_WEBHOOK_SECRET;
		Object.assign(env, { STRIPE_WEBHOOK_SECRET: undefined });
		try {
			const request = new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "stripe-signature": "test" },
				body: "{}",
			});
			const err = await stripePaymentProvider
				.parseWebhook(request)
				.catch((e: unknown) => e);
			expect(err).toBeInstanceOf(WebhookConfigError);
		} finally {
			Object.assign(env, { STRIPE_WEBHOOK_SECRET: original });
		}
	});

	it("resolves productId from line items for one-time checkout.completed", async () => {
		webhooksConstructEventAsync.mockResolvedValueOnce({
			type: "checkout.session.completed",
			data: {
				object: {
					id: "cs_test_123",
					subscription: null,
					customer: "cust_123",
					metadata: { user_id: "user_123" },
				},
			},
			id: "evt_1",
		} as never);
		listLineItems.mockClear();
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "stripe-signature": "test" },
			body: "{}",
		});
		const events = await stripePaymentProvider.parseWebhook(request);
		expect(listLineItems).toHaveBeenCalledWith("cs_test_123", { limit: 1 });
		expect(events[0]).toMatchObject({
			type: "checkout.completed",
			eventId: "evt_1",
			productId: "price_topup",
			metadata: { user_id: "user_123" },
		});
	});

	it("setSubscriptionSeats calls subscriptions.retrieve then update", async () => {
		subscriptionsRetrieve.mockClear();
		subscriptionsUpdate.mockClear();
		await stripePaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_123",
			seats: 5,
		});
		expect(subscriptionsRetrieve).toHaveBeenCalledOnce();
		expect(subscriptionsUpdate).toHaveBeenCalledOnce();
	});
});
