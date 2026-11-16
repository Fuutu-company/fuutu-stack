import { env } from "@fuutu/env/saas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	isProviderRequestError,
	ProviderRequestError,
	WebhookConfigError,
	WebhookSignatureError,
} from "../types";

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
const { paymentsConfig } = await import("../config");

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
				json: async () => ({
					items: [{ id: "item_123", product_id: "prod_123" }],
				}),
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

describe("creem provider — setSubscriptionSeats request (update-subscription schema)", () => {
	const defaultBehavior = paymentsConfig.creemUpdateBehavior;

	beforeEach(() => {
		mockFetch.mockReset();
		paymentsConfig.creemUpdateBehavior = defaultBehavior;
	});

	function stubSubscription(subscription: unknown) {
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => subscription })
			.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
	}

	const updateCall = () => {
		const [url, init] = mockFetch.mock.calls[1] ?? [];
		return {
			url: String(url),
			method: (init as RequestInit | undefined)?.method,
			body: JSON.parse(String((init as RequestInit | undefined)?.body)),
		};
	};

	it("sends items[{ id, price_id, units }] and an explicit update_behavior", async () => {
		stubSubscription({
			id: "sub_1",
			product: { id: "prod_seat" },
			items: [
				{
					id: "sitem_1",
					product_id: "prod_seat",
					price_id: "pprice_seat",
					units: 3,
				},
			],
		});

		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_1",
			seats: 15,
		});

		const call = updateCall();
		expect(call.url).toBe("https://test-api.creem.io/v1/subscriptions/sub_1");
		expect(call.method).toBe("POST");
		expect(call.body).toEqual({
			items: [{ id: "sitem_1", price_id: "pprice_seat", units: 15 }],
			update_behavior: "proration-charge-immediately",
		});
		// `quantity` is not part of UpsertSubscriptionItemEntity.
		expect(call.body.items[0]).not.toHaveProperty("quantity");
	});

	it("falls back to the item's product_id, then the subscription product", async () => {
		stubSubscription({
			items: [{ id: "sitem_1", product_id: "prod_item" }],
		});
		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_1",
			seats: 2,
		});
		expect(updateCall().body.items).toEqual([
			{ id: "sitem_1", product_id: "prod_item", units: 2 },
		]);

		mockFetch.mockReset();
		stubSubscription({ product: "prod_sub", items: [{ id: "sitem_2" }] });
		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_2",
			seats: 4,
		});
		expect(updateCall().body.items).toEqual([
			{ id: "sitem_2", product_id: "prod_sub", units: 4 },
		]);
	});

	it("refuses to send an item Creem cannot resolve (no price or product)", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ items: [{ id: "sitem_1" }] }),
		});
		await expect(
			creemPaymentProvider.setSubscriptionSeats({
				subscriptionId: "sub_1",
				seats: 4,
			}),
		).rejects.toThrow(/product or price/);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it("uses paymentsConfig.creemUpdateBehavior", async () => {
		paymentsConfig.creemUpdateBehavior = "proration-none";
		stubSubscription({ items: [{ id: "sitem_1", price_id: "pprice_1" }] });
		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_1",
			seats: 6,
		});
		expect(updateCall().body.update_behavior).toBe("proration-none");
	});
});

describe("creem provider — getSubscriptionStatus", () => {
	beforeEach(() => mockFetch.mockReset());

	it.each([
		["canceled", "CANCELED"],
		["expired", "EXPIRED"],
		["active", "ACTIVE"],
		["unpaid", "PAST_DUE"],
	])("maps a %s subscription to %s", async (status, expected) => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id: "sub_1", status }),
		});
		await expect(
			creemPaymentProvider.getSubscriptionStatus?.("sub_1"),
		).resolves.toBe(expected);
		expect(String(mockFetch.mock.calls[0]?.[0])).toBe(
			"https://test-api.creem.io/v1/subscriptions?subscription_id=sub_1",
		);
	});

	it("throws when the lookup fails", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 503,
			json: async () => ({}),
		});
		await expect(
			creemPaymentProvider.getSubscriptionStatus?.("sub_1"),
		).rejects.toThrow();
	});
});

describe("creem provider — subscription.unpaid", () => {
	async function parseSigned(payload: unknown) {
		const crypto = await import("node:crypto");
		const body = JSON.stringify(payload);
		const signature = crypto
			.createHmac("sha256", "test-webhook-secret")
			.update(body)
			.digest("hex");
		return creemPaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "creem-signature": signature },
				body,
			}),
		);
	}

	it("maps subscription.unpaid with status unpaid to a PAST_DUE event", async () => {
		const events = await parseSigned({
			id: "evt_unpaid",
			eventType: "subscription.unpaid",
			object: {
				id: "sub_1",
				product: { id: "prod_1" },
				status: "unpaid",
				metadata: { organization_id: "org_1" },
			},
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "subscription.past_due",
			subscriptionId: "sub_1",
			status: "PAST_DUE",
		});
	});

	it("maps an unpaid status on other events to PAST_DUE, not INCOMPLETE", async () => {
		const events = await parseSigned({
			eventType: "subscription.update",
			object: { id: "sub_1", product: { id: "prod_1" }, status: "unpaid" },
		});
		expect(events[0]?.status).toBe("PAST_DUE");
	});
});

describe("creem provider — purchased units", () => {
	async function parseSigned(payload: unknown) {
		const crypto = await import("node:crypto");
		const body = JSON.stringify(payload);
		const signature = crypto
			.createHmac("sha256", "test-webhook-secret")
			.update(body)
			.digest("hex");
		return creemPaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "creem-signature": signature },
				body,
			}),
		);
	}

	it("reads units from a one-time checkout object", async () => {
		const events = await parseSigned({
			id: "evt_co",
			eventType: "checkout.completed",
			object: { id: "ch_1", product: { id: "prod_1" }, units: 3 },
		});
		expect(events[0]?.units).toBe(3);
	});

	it("reads units from subscription items[]", async () => {
		const events = await parseSigned({
			eventType: "subscription.active",
			object: {
				id: "sub_1",
				product: { id: "prod_1" },
				status: "active",
				items: [{ units: 4 }],
			},
		});
		expect(events[0]?.units).toBe(4);
	});

	it("reads units from the embedded checkout on a renewal", async () => {
		const events = await parseSigned({
			eventType: "subscription.paid",
			object: {
				id: "sub_1",
				product: { id: "prod_1" },
				status: "active",
				checkout: { units: 2 },
			},
		});
		expect(events[0]).toMatchObject({ type: "subscription.renewed", units: 2 });
	});

	it("leaves units undefined when the payload reports none", async () => {
		const events = await parseSigned({
			eventType: "subscription.active",
			object: { id: "sub_1", product: { id: "prod_1" }, status: "active" },
		});
		expect(events[0]?.units).toBeUndefined();
	});
});

describe("creem provider — per-call seat proration", () => {
	const defaultBehavior = paymentsConfig.creemUpdateBehavior;

	beforeEach(() => {
		mockFetch.mockReset();
		paymentsConfig.creemUpdateBehavior = defaultBehavior;
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [{ id: "sitem_1", price_id: "pprice_1" }],
				}),
			})
			.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
	});

	const sentBehavior = () =>
		JSON.parse(
			String((mockFetch.mock.calls[1]?.[1] as RequestInit | undefined)?.body),
		).update_behavior;

	it("setSubscriptionSeats sends proration-none when asked", async () => {
		paymentsConfig.creemUpdateBehavior = "proration-charge-immediately";
		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_1",
			seats: 2,
			proration: "none",
		});
		expect(sentBehavior()).toBe("proration-none");
	});

	it("setSubscriptionSeats sends proration-charge-immediately when asked", async () => {
		paymentsConfig.creemUpdateBehavior = "proration-none";
		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_1",
			seats: 4,
			proration: "charge-immediately",
		});
		expect(sentBehavior()).toBe("proration-charge-immediately");
	});

	it("without proration it sends the configured default", async () => {
		paymentsConfig.creemUpdateBehavior = "proration-none";
		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_1",
			seats: 3,
		});
		expect(sentBehavior()).toBe("proration-none");
	});
});

describe("creem provider — cancel at period end and resume", () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	const call = (index = 0) => {
		const [url, init] = mockFetch.mock.calls[index] ?? [];
		const request = init as RequestInit | undefined;
		return {
			url: String(url),
			method: request?.method,
			body:
				request?.body === undefined
					? undefined
					: JSON.parse(String(request.body)),
		};
	};

	it("cancel with atPeriodEnd sends the scheduled mode", async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
		await creemPaymentProvider.cancelSubscription("sub_1", {
			atPeriodEnd: true,
		});
		expect(call()).toEqual({
			url: "https://test-api.creem.io/v1/subscriptions/sub_1/cancel",
			method: "POST",
			body: { mode: "scheduled" },
		});
	});

	it.each([
		["immediate", "immediate"],
		["period_end", "scheduled"],
	] as const)(
		"cancel with mode %s sends Creem mode %s",
		async (mode, creemMode) => {
			mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
			await creemPaymentProvider.cancelSubscription("sub_1", { mode });
			expect(call()).toEqual({
				url: "https://test-api.creem.io/v1/subscriptions/sub_1/cancel",
				method: "POST",
				body: { mode: creemMode },
			});
		},
	);

	it("an explicit mode wins over atPeriodEnd", async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
		await creemPaymentProvider.cancelSubscription("sub_1", {
			mode: "immediate",
			atPeriodEnd: true,
		});
		expect(call().body).toEqual({ mode: "immediate" });
	});

	it("cancel without options sends no body (store default, as before)", async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
		await creemPaymentProvider.cancelSubscription("sub_1");
		expect(call()).toEqual({
			url: "https://test-api.creem.io/v1/subscriptions/sub_1/cancel",
			method: "POST",
			body: undefined,
		});
	});

	it("resumeSubscription posts to the resume endpoint", async () => {
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
		await creemPaymentProvider.resumeSubscription?.("sub_1");
		expect(call()).toEqual({
			url: "https://test-api.creem.io/v1/subscriptions/sub_1/resume",
			method: "POST",
			body: undefined,
		});
	});

	it("resumeSubscription throws when Creem refuses", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			json: async () => ({ message: "not scheduled" }),
		});
		await expect(
			creemPaymentProvider.resumeSubscription?.("sub_1"),
		).rejects.toThrow("Failed to resume subscription");
	});

	it("encodes the subscription id in cancel and resume paths", async () => {
		mockFetch
			.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
			.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
		await creemPaymentProvider.cancelSubscription("sub/../x?y", {
			atPeriodEnd: true,
		});
		await creemPaymentProvider.resumeSubscription?.("sub/../x?y");
		expect(call(0).url).toBe(
			"https://test-api.creem.io/v1/subscriptions/sub%2F..%2Fx%3Fy/cancel",
		);
		expect(call(1).url).toBe(
			"https://test-api.creem.io/v1/subscriptions/sub%2F..%2Fx%3Fy/resume",
		);
	});

	it("encodes the subscription id in the seat update paths", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [{ id: "sitem_1", price_id: "pprice_1" }],
				}),
			})
			.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
		await creemPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub/x&y",
			seats: 2,
		});
		expect(call(0).url).toBe(
			"https://test-api.creem.io/v1/subscriptions?subscription_id=sub%2Fx%26y",
		);
		expect(call(1).url).toBe(
			"https://test-api.creem.io/v1/subscriptions/sub%2Fx%26y",
		);
	});

	it("declares that its trials live on the product", () => {
		expect(creemPaymentProvider.trialsOnProduct).toBe(true);
	});
});

const { testPaymentProviderContract } = await import("./provider-contract");
testPaymentProviderContract("creem", () => creemPaymentProvider, {
	behavior: "shape",
});

describe("creem provider — getSubscriptionSeats", () => {
	beforeEach(() => mockFetch.mockReset());

	it("reads the units of the subscription's item", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				id: "sub_1",
				items: [{ id: "sitem_1", product_id: "prod_seat", units: 4 }],
			}),
		});

		await expect(
			creemPaymentProvider.getSubscriptionSeats?.("sub_1"),
		).resolves.toBe(4);
		const [url, init] = mockFetch.mock.calls[0] ?? [];
		expect(String(url)).toBe(
			"https://test-api.creem.io/v1/subscriptions?subscription_id=sub_1",
		);
		expect((init as RequestInit).method).toBe("GET");
	});

	it("fails closed when the item reports no units (Creem always sends them)", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ items: [{ id: "sitem_1", product_id: "p" }] }),
		});
		await expect(
			creemPaymentProvider.getSubscriptionSeats?.("sub_1"),
		).rejects.toThrow();
	});

	it("fails closed when Creem answers with an error or no item", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 404,
			json: async () => ({ message: "not found" }),
		});
		await expect(
			creemPaymentProvider.getSubscriptionSeats?.("sub_1"),
		).rejects.toThrow();

		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ items: [] }),
		});
		await expect(
			creemPaymentProvider.getSubscriptionSeats?.("sub_1"),
		).rejects.toThrow();
	});
});

describe("creem provider — typed API failures", () => {
	beforeEach(() => {
		mockFetch.mockReset();
	});

	const creemError = (status: number, message: string | readonly string[]) => ({
		ok: false,
		status,
		json: async () => ({
			trace_id: "t",
			status,
			error: "Bad Request",
			message,
		}),
	});

	it.each([
		// What Creem test mode answers (probed 2026-11-15).
		[404, ["Subscription does not exist"], "not_found"],
		[400, "Subscription does not exist", "not_found"],
		[404, ["Customer was not found"], "not_found"],
		[
			400,
			"Subscription cannot be canceled in state: canceled",
			"invalid_state",
		],
		[400, "Cannot resume subscription in active status", "invalid_state"],
		[400, ["units must be a positive number"], "rejected"],
		[500, ["Internal error"], "unavailable"],
		[429, ["Too many requests"], "unavailable"],
	] as const)(
		"HTTP %i %j is a ProviderRequestError of kind %s",
		async (status, message, kind) => {
			mockFetch.mockResolvedValueOnce(creemError(status, message));
			const failure = await creemPaymentProvider
				.cancelSubscription("sub_1", { atPeriodEnd: true })
				.catch((err: unknown) => err);
			expect(failure).toBeInstanceOf(ProviderRequestError);
			expect(failure).toMatchObject({ kind, status });
			expect(isProviderRequestError(failure)).toBe(true);
		},
	);

	it("keeps the provider's own messages out of the error message", async () => {
		mockFetch.mockResolvedValueOnce(
			creemError(400, ["Subscription cannot be canceled in state: canceled"]),
		);
		const failure = await creemPaymentProvider
			.cancelSubscription("sub_1")
			.catch((err: unknown) => err);
		expect(failure).toMatchObject({
			message: "Failed to cancel subscription",
			detail: "Subscription cannot be canceled in state: canceled",
		});
	});

	it.each([401, 403])(
		"HTTP %i (wrong or missing API key) is a configuration error",
		async (status) => {
			mockFetch.mockResolvedValueOnce(creemError(status, ["Invalid API Key"]));
			await expect(
				creemPaymentProvider.resumeSubscription?.("sub_1"),
			).rejects.toBeInstanceOf(WebhookConfigError);
		},
	);

	it("a network failure is unavailable, not a raw TypeError", async () => {
		mockFetch.mockRejectedValueOnce(new TypeError("fetch failed"));
		await expect(
			creemPaymentProvider.createCustomerPortalLink({ customerId: "cus_1" }),
		).rejects.toMatchObject({
			name: "ProviderRequestError",
			kind: "unavailable",
		});
	});

	it("every Creem call carries a timeout signal, so a hanging API cannot stall the request", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ customer_portal_link: "https://portal.test/url" }),
		});
		await creemPaymentProvider.createCustomerPortalLink({
			customerId: "cus_1",
		});
		const init = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
		expect(init?.signal).toBeInstanceOf(AbortSignal);
	});

	it("a timed-out Creem call is unavailable", async () => {
		mockFetch.mockRejectedValueOnce(
			new DOMException("The operation timed out.", "TimeoutError"),
		);
		await expect(
			creemPaymentProvider.createCustomerPortalLink({ customerId: "cus_1" }),
		).rejects.toMatchObject({
			name: "ProviderRequestError",
			kind: "unavailable",
		});
	});

	it("an error body that is not JSON still classifies by status", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 502,
			json: async () => {
				throw new SyntaxError("Unexpected token <");
			},
		});
		await expect(
			creemPaymentProvider.createCheckoutLink({ priceId: "prod_1" }),
		).rejects.toMatchObject({ kind: "unavailable", status: 502 });
	});

	it("every Creem call classifies its failure (portal, seats lookup, seat update)", async () => {
		mockFetch.mockResolvedValueOnce(
			creemError(404, ["Customer was not found"]),
		);
		await expect(
			creemPaymentProvider.createCustomerPortalLink({ customerId: "cus_x" }),
		).rejects.toMatchObject({ kind: "not_found" });
		mockFetch.mockResolvedValueOnce(
			creemError(404, ["Subscription does not exist"]),
		);
		await expect(
			creemPaymentProvider.getSubscriptionSeats?.("sub_x"),
		).rejects.toMatchObject({ kind: "not_found" });
		mockFetch.mockResolvedValueOnce(
			creemError(404, ["Subscription does not exist"]),
		);
		await expect(
			creemPaymentProvider.getSubscriptionStatus?.("sub_x"),
		).rejects.toMatchObject({ kind: "not_found" });
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					items: [{ id: "item_1", price_id: "pprice_1", units: 1 }],
				}),
			})
			.mockResolvedValueOnce(
				creemError(400, ["units must be a positive number"]),
			);
		await expect(
			creemPaymentProvider.setSubscriptionSeats({
				subscriptionId: "sub_1",
				seats: 2,
			}),
		).rejects.toMatchObject({ kind: "rejected" });
	});
});

describe("creem provider — trials", () => {
	it("declares that a cancel ends a trial now (no cancel at trial end)", () => {
		// Creem test mode, 2026-11-15: POST /subscriptions/{id}/cancel with
		// mode "scheduled" on a trialing subscription answers "canceled".
		expect(creemPaymentProvider.cancelEndsTrial).toBe(true);
	});
});

describe("creem provider — refunds and disputes", () => {
	async function parse(payload: unknown) {
		const crypto = await import("node:crypto");
		const body = JSON.stringify(payload);
		const signature = crypto
			.createHmac("sha256", "test-webhook-secret")
			.update(body)
			.digest("hex");
		return creemPaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "creem-signature": signature },
				body,
			}),
		);
	}

	// Shape of Creem's refund.created object (refund + its transaction,
	// subscription, checkout and order).
	const refund = (overrides: Record<string, unknown> = {}) => ({
		id: "evt_refund",
		eventType: "refund.created",
		object: {
			id: "ref_1",
			object: "refund",
			status: "succeeded",
			refund_amount: 1900,
			transaction: {
				id: "tran_1",
				amount_paid: 1900,
				status: "refunded",
			},
			subscription: { id: "sub_1", status: "active" },
			checkout: { id: "ch_1" },
			order: { id: "ord_1" },
			customer: { id: "cust_1" },
			...overrides,
		},
	});

	it("keeps the checkout id as the payment reference of a one-time checkout", async () => {
		const events = await parse({
			id: "evt_co",
			eventType: "checkout.completed",
			object: {
				id: "ch_1",
				product: { id: "prod_topup" },
				metadata: { user_id: "user_1" },
			},
		});
		expect(events[0]).toMatchObject({
			type: "checkout.completed",
			paymentRef: "ch_1",
		});
	});

	it("maps a full refund of a subscription payment to payment.reversed of the subscription", async () => {
		const events = await parse(refund());
		expect(events).toEqual([
			{
				type: "payment.reversed",
				eventId: "evt_refund",
				subscriptionId: "sub_1",
			},
		]);
	});

	it("maps a full refund of a one-time payment to payment.reversed by checkout", async () => {
		const events = await parse(refund({ subscription: null }));
		expect(events).toEqual([
			{ type: "payment.reversed", eventId: "evt_refund", paymentRef: "ch_1" },
		]);
	});

	it("counts a refund of the whole paid amount as full", async () => {
		const events = await parse(
			refund({
				transaction: { id: "tran_1", amount_paid: 1900, status: "paid" },
			}),
		);
		expect(events[0]?.type).toBe("payment.reversed");
	});

	it("ignores a partial refund", async () => {
		const events = await parse(
			refund({
				refund_amount: 500,
				transaction: {
					id: "tran_1",
					amount_paid: 1900,
					status: "partialRefund",
				},
			}),
		);
		expect(events).toEqual([]);
	});

	it("ignores a refund it cannot tell full from partial", async () => {
		const events = await parse(
			refund({ refund_amount: undefined, transaction: undefined }),
		);
		expect(events).toEqual([]);
	});

	it("maps a dispute to payment.reversed", async () => {
		const events = await parse({
			id: "evt_dispute",
			eventType: "dispute.created",
			object: {
				id: "disp_1",
				object: "dispute",
				amount: 1900,
				transaction: { id: "tran_1", status: "chargedBack" },
				subscription: null,
				checkout: { id: "ch_2" },
			},
		});
		expect(events).toEqual([
			{ type: "payment.reversed", eventId: "evt_dispute", paymentRef: "ch_2" },
		]);
	});
});
