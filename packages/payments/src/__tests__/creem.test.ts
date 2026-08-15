import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@fuutu/env/saas", () => ({
	env: {
		CREEM_API_KEY: "test-creem-key",
		CREEM_WEBHOOK_SECRET: "test-webhook-secret",
		CREEM_TEST_MODE: true,
		NODE_ENV: "test",
	},
}));

const { creemPaymentProvider } = await import("../providers/creem");

describe("creem provider — SDK integration", () => {
	beforeEach(() => {
		mockFetch.mockClear();
	});
	it("createCheckoutLink calls Creem API and returns the url", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ checkout_url: "https://checkout.test/url" }),
		});
		const result = await creemPaymentProvider.createCheckoutLink({
			priceId: "prod_abc",
			userId: "user_123",
		});
		expect(result.url).toBe("https://checkout.test/url");
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("createCustomerPortalLink calls Creem API and returns the url", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ customer_portal_link: "https://portal.test/url" }),
		});
		const result = await creemPaymentProvider.createCustomerPortalLink({
			customerId: "cust_123",
		});
		expect(result.url).toBe("https://portal.test/url");
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("createCustomer calls Creem API and returns the id", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: "cust_creem_123" }),
		});
		const result = await creemPaymentProvider.createCustomer({
			userId: "user_123",
			email: "test@test.com",
		});
		expect(result.customerId).toBe("cust_creem_123");
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("cancelSubscription calls Creem API", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({}),
		});
		await creemPaymentProvider.cancelSubscription("sub_123");
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("ownsSeatSync is false (we manage seats, not Creem)", () => {
		expect(creemPaymentProvider.ownsSeatSync).toBe(false);
	});

	it("parseWebhook returns ProviderEvent[] on a valid signature", async () => {
		const crypto = await import("node:crypto");
		const body = JSON.stringify({
			eventType: "subscription.active",
			object: {
				id: "sub_123",
				customer: "cust_123",
				product: { id: "prod_123" },
				status: "active",
			},
		});
		const signature = crypto
			.createHmac("sha256", "test-webhook-secret")
			.update(body)
			.digest("hex");
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"creem-signature": signature,
			},
			body,
		});
		const events = await creemPaymentProvider.parseWebhook(request);
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
		await expect(creemPaymentProvider.parseWebhook(request)).rejects.toThrow(
			"Missing signature",
		);
	});

	it("parseWebhook throws on invalid signature", async () => {
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"creem-signature": "invalid",
			},
			body: "{}",
		});
		await expect(creemPaymentProvider.parseWebhook(request)).rejects.toThrow(
			"Invalid signature",
		);
	});

	it("setSubscriptionSeats calls Creem API to update seats", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ items: [{ id: "item_123" }] }),
			})
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({}),
			});
		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_123",
			seats: 5,
		});
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});
