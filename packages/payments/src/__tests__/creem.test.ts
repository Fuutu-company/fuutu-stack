import { env } from "@fuutu/env/saas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WebhookConfigError, WebhookSignatureError } from "../types";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@fuutu/env/saas", () => ({
	env: {
		CREEM_API_KEY: "test-creem-key",
		CREEM_WEBHOOK_SECRET: "test-webhook-secret",
		CREEM_TEST_MODE: true,
		NEXT_PUBLIC_SAAS_URL: "https://app.test",
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

	it("createCheckoutLink keeps owner metadata authoritative over input.metadata", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ checkout_url: "https://checkout.test/url" }),
		});
		await creemPaymentProvider.createCheckoutLink({
			priceId: "prod_abc",
			userId: "user_123",
			organizationId: "org_123",
			metadata: {
				user_id: "attacker_user",
				organization_id: "attacker_org",
				extra: "kept",
			},
		});
		const init = mockFetch.mock.calls[0]?.[1];
		const body = JSON.parse(init?.body as string);
		expect(body.metadata).toMatchObject({
			user_id: "user_123",
			organization_id: "org_123",
			extra: "kept",
		});
	});

	it("createCustomer keeps user_id authoritative over input.metadata", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: "cust_creem_123" }),
		});
		await creemPaymentProvider.createCustomer({
			userId: "user_123",
			email: "test@test.com",
			metadata: { user_id: "attacker_user" },
		});
		const init = mockFetch.mock.calls[0]?.[1];
		const body = JSON.parse(init?.body as string);
		expect(body.metadata.user_id).toBe("user_123");
	});

	it("throws a misconfiguration error when CREEM_API_KEY is not set", async () => {
		const original = env.CREEM_API_KEY;
		Object.assign(env, { CREEM_API_KEY: undefined });
		try {
			await expect(
				creemPaymentProvider.createCheckoutLink({ priceId: "prod_abc" }),
			).rejects.toThrow("CREEM_API_KEY is not set");
			expect(mockFetch).not.toHaveBeenCalled();
		} finally {
			Object.assign(env, { CREEM_API_KEY: original });
		}
	});

	it("cancelSubscription calls Creem API", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({}),
		});
		await creemPaymentProvider.cancelSubscription("sub_123");
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("createCheckoutLink defaults success_url to the SaaS app URL", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ checkout_url: "https://checkout.test/url" }),
		});
		await creemPaymentProvider.createCheckoutLink({ priceId: "prod_abc" });
		const init = mockFetch.mock.calls[0]?.[1];
		const body = JSON.parse(init?.body as string);
		expect(body.success_url).toBe("https://app.test");
	});

	it("createCheckoutLink throws WebhookConfigError on a relative success URL", async () => {
		const err = await creemPaymentProvider
			.createCheckoutLink({ priceId: "prod_abc", successUrl: "/done" })
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(WebhookConfigError);
		expect(mockFetch).not.toHaveBeenCalled();
	});

	it("createCheckoutLink throws WebhookConfigError when no success URL fallback is configured", async () => {
		const original = env.NEXT_PUBLIC_SAAS_URL;
		Object.assign(env, { NEXT_PUBLIC_SAAS_URL: undefined });
		try {
			const err = await creemPaymentProvider
				.createCheckoutLink({ priceId: "prod_abc" })
				.catch((e: unknown) => e);
			expect(err).toBeInstanceOf(WebhookConfigError);
			expect(mockFetch).not.toHaveBeenCalled();
		} finally {
			Object.assign(env, { NEXT_PUBLIC_SAAS_URL: original });
		}
	});

	it("createCheckoutLink prefers an explicit absolute success URL", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ checkout_url: "https://checkout.test/url" }),
		});
		await creemPaymentProvider.createCheckoutLink({
			priceId: "prod_abc",
			successUrl: "https://custom.test/done",
		});
		const init = mockFetch.mock.calls[0]?.[1];
		const body = JSON.parse(init?.body as string);
		expect(body.success_url).toBe("https://custom.test/done");
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

	it("parseWebhook throws a clear error on a signed but non-JSON body", async () => {
		const crypto = await import("node:crypto");
		const body = "this is not json{{{";
		const signature = crypto
			.createHmac("sha256", "test-webhook-secret")
			.update(body)
			.digest("hex");
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "creem-signature": signature },
			body,
		});
		const err = await creemPaymentProvider
			.parseWebhook(request)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(Error);
		expect(err).not.toBeInstanceOf(SyntaxError);
		expect((err as Error).message).toContain("Malformed webhook payload");
	});

	it("parseWebhook throws on a signed but malformed payload", async () => {
		const crypto = await import("node:crypto");
		const body = JSON.stringify({ eventType: 123 });
		const signature = crypto
			.createHmac("sha256", "test-webhook-secret")
			.update(body)
			.digest("hex");
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "creem-signature": signature },
			body,
		});
		await expect(creemPaymentProvider.parseWebhook(request)).rejects.toThrow(
			"Malformed webhook payload",
		);
	});

	it("parseWebhook surfaces the envelope event id for dedup", async () => {
		const crypto = await import("node:crypto");
		const body = JSON.stringify({
			id: "evt_123",
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
			headers: { "creem-signature": signature },
			body,
		});
		const events = await creemPaymentProvider.parseWebhook(request);
		expect(events[0]?.eventId).toBe("evt_123");
	});

	it("parseWebhook throws WebhookSignatureError on missing signature", async () => {
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			body: "{}",
		});
		const err = await creemPaymentProvider
			.parseWebhook(request)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(WebhookSignatureError);
		expect((err as Error).message).toContain("signature");
	});

	it("parseWebhook throws WebhookSignatureError on invalid signature", async () => {
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"creem-signature": "invalid",
			},
			body: "{}",
		});
		const err = await creemPaymentProvider
			.parseWebhook(request)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(WebhookSignatureError);
		expect((err as Error).message).toContain("signature");
	});

	it("parseWebhook throws WebhookConfigError when the webhook secret is not configured", async () => {
		const original = env.CREEM_WEBHOOK_SECRET;
		Object.assign(env, { CREEM_WEBHOOK_SECRET: undefined });
		try {
			const request = new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "creem-signature": "deadbeef" },
				body: "{}",
			});
			const err = await creemPaymentProvider
				.parseWebhook(request)
				.catch((e: unknown) => e);
			expect(err).toBeInstanceOf(WebhookConfigError);
			expect((err as Error).message.toLowerCase()).toContain("secret");
		} finally {
			Object.assign(env, { CREEM_WEBHOOK_SECRET: original });
		}
	});

	it("parseWebhook falls back to the object id when the envelope id is absent", async () => {
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
			headers: { "creem-signature": signature },
			body,
		});
		const events = await creemPaymentProvider.parseWebhook(request);
		expect(events[0]?.eventId).toBe("sub_123");
	});

	it("parseWebhook tolerates a payload with neither envelope id nor object id", async () => {
		const crypto = await import("node:crypto");
		const body = JSON.stringify({
			eventType: "subscription.canceled",
			object: { customer: "cust_123", status: "canceled" },
		});
		const signature = crypto
			.createHmac("sha256", "test-webhook-secret")
			.update(body)
			.digest("hex");
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "creem-signature": signature },
			body,
		});
		// Must not crash — the event still parses, with eventId and
		// subscriptionId left undefined. Webhook dedup is skipped for
		// id-less events (sync treats eventId as optional).
		const events = await creemPaymentProvider.parseWebhook(request);
		expect(events[0]?.type).toBe("subscription.canceled");
		expect(events[0]?.eventId).toBeUndefined();
		expect(events[0]?.subscriptionId).toBeUndefined();
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
