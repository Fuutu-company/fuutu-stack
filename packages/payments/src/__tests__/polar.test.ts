import { describe, expect, it, vi } from "vitest";

const checkoutsCreate = vi
	.fn()
	.mockResolvedValue({ url: "https://checkout.test/url" });
const customerSessionsCreate = vi.fn().mockResolvedValue({
	customerPortalUrl: "https://portal.test/url",
});
const subscriptionsRevoke = vi.fn().mockResolvedValue(undefined);
const customersCreate = vi.fn().mockResolvedValue({ id: "cust_polar_123" });

vi.mock("@polar-sh/sdk", () => ({
	Polar: class MockPolar {
		checkouts = { create: checkoutsCreate };
		customerSessions = { create: customerSessionsCreate };
		subscriptions = { revoke: subscriptionsRevoke };
		customers = { create: customersCreate };
	},
}));

vi.mock("@polar-sh/sdk/webhooks", () => ({
	validateEvent: vi.fn().mockReturnValue({
		type: "subscription.created",
		data: {
			subscription_id: "sub_123",
			customer_id: "cust_123",
			product_id: "prod_123",
			metadata: { user_id: "user_123", organization_id: "org_123" },
		},
	}),
	WebhookVerificationError: class WebhookVerificationError extends Error {},
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		POLAR_ACCESS_TOKEN: "test-polar-token",
		POLAR_SUCCESS_URL: "https://app.test/success",
		POLAR_WEBHOOK_SECRET: "test-webhook-secret",
		NODE_ENV: "test",
	},
}));

const { polarPaymentProvider } = await import("../providers/polar");

describe("polar provider — SDK integration", () => {
	it("createCheckoutLink calls Polar checkouts.create and returns the url", async () => {
		checkoutsCreate.mockClear();
		const result = await polarPaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
		});
		expect(result.url).toBe("https://checkout.test/url");
		expect(checkoutsCreate).toHaveBeenCalledOnce();
	});

	it("createCustomerPortalLink calls customerSessions.create and returns the url", async () => {
		customerSessionsCreate.mockClear();
		const result = await polarPaymentProvider.createCustomerPortalLink({
			customerId: "cust_123",
		});
		expect(result.url).toBe("https://portal.test/url");
		expect(customerSessionsCreate).toHaveBeenCalledOnce();
	});

	it("createCustomer calls customers.create and returns the id", async () => {
		customersCreate.mockClear();
		const result = await polarPaymentProvider.createCustomer({
			userId: "user_123",
			email: "test@test.com",
		});
		expect(result.customerId).toBe("cust_polar_123");
		expect(customersCreate).toHaveBeenCalledOnce();
	});

	it("cancelSubscription calls subscriptions.revoke", async () => {
		subscriptionsRevoke.mockClear();
		await polarPaymentProvider.cancelSubscription("sub_123");
		expect(subscriptionsRevoke).toHaveBeenCalledOnce();
	});

	it("ownsSeatSync is false (we manage seats, not Polar BA plugin)", () => {
		expect(polarPaymentProvider.ownsSeatSync).toBe(false);
	});

	it("parseWebhook returns ProviderEvent[] on a valid signature", async () => {
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"webhook-id": "test",
				"webhook-timestamp": "123",
				"webhook-signature": "test",
			},
			body: "{}",
		});
		const events = await polarPaymentProvider.parseWebhook(request);
		expect(Array.isArray(events)).toBe(true);
		expect(events.length).toBe(1);
		expect(events[0]?.type).toBe("subscription.activated");
		expect(events[0]?.subscriptionId).toBe("sub_123");
		// user_id / organization_id live in data.metadata — not on the
		// event object itself.
		expect(events[0]?.metadata).toEqual({
			user_id: "user_123",
			organization_id: "org_123",
		});
		// Standard-webhooks delivery id is used as the dedup marker.
		expect(events[0]?.eventId).toBe("test");
	});

	it("parseWebhook throws on invalid signature", async () => {
		const { validateEvent, WebhookVerificationError } = await import(
			"@polar-sh/sdk/webhooks"
		);
		vi.mocked(validateEvent).mockImplementationOnce(() => {
			throw new WebhookVerificationError("invalid signature");
		});
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"webhook-id": "test",
				"webhook-timestamp": "123",
				"webhook-signature": "bad",
			},
			body: "{}",
		});
		await expect(polarPaymentProvider.parseWebhook(request)).rejects.toThrow(
			"signature",
		);
	});

	it("is not seat-aware — Polar seat management is dashboard-side, so the provider must not claim setSubscriptionSeats", async () => {
		const { isSeatAware } = await import("../types");
		expect(isSeatAware(polarPaymentProvider)).toBe(false);
	});
});
