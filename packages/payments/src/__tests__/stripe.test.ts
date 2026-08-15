import { describe, expect, it, vi } from "vitest";

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

vi.mock("stripe", () => ({
	default: class MockStripe {
		checkout = { sessions: { create: checkoutCreate } };
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

	it("parseWebhook throws on missing signature", async () => {
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			body: "{}",
		});
		await expect(stripePaymentProvider.parseWebhook(request)).rejects.toThrow(
			"signature",
		);
	});

	it("parseWebhook throws on invalid signature", async () => {
		webhooksConstructEventAsync.mockImplementationOnce(() => {
			throw new Error("signature");
		});
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"stripe-signature": "bad",
			},
			body: "{}",
		});
		await expect(stripePaymentProvider.parseWebhook(request)).rejects.toThrow(
			"signature",
		);
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
