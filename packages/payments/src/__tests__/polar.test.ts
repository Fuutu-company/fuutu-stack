import { env } from "@fuutu/env/saas";
import { describe, expect, it, vi } from "vitest";
import { WebhookConfigError, WebhookSignatureError } from "../types";

const checkoutsCreate = vi
	.fn()
	.mockResolvedValue({ url: "https://checkout.test/url" });
const customerSessionsCreate = vi.fn().mockResolvedValue({
	customerPortalUrl: "https://portal.test/url",
});
const subscriptionsRevoke = vi.fn().mockResolvedValue(undefined);
const subscriptionsUpdate = vi.fn().mockResolvedValue(undefined);
const customersCreate = vi.fn().mockResolvedValue({ id: "cust_polar_123" });

vi.mock("@polar-sh/sdk", () => ({
	Polar: class MockPolar {
		checkouts = { create: checkoutsCreate };
		customerSessions = { create: customerSessionsCreate };
		subscriptions = {
			revoke: subscriptionsRevoke,
			update: subscriptionsUpdate,
		};
		customers = { create: customersCreate };
	},
}));

// Fixtures model the POST-TRANSFORM shape validateEvent returns — the
// SDK's inbound zod schemas remap wire snake_case to camelCase
// (billing_reason→billingReason, subscription_id→subscriptionId, dates
// → Date objects). Mocking the wire shape would test a contract the
// real SDK never produces.
vi.mock("@polar-sh/sdk/webhooks", () => ({
	validateEvent: vi.fn().mockReturnValue({
		type: "subscription.active",
		data: {
			id: "sub_123",
			status: "active",
			customerId: "cust_123",
			productId: "prod_123",
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

/** Feed a synthetic Polar payload through the mocked validateEvent. */
async function parsePayload(payload: unknown) {
	const { validateEvent } = await import("@polar-sh/sdk/webhooks");
	vi.mocked(validateEvent).mockReturnValueOnce(payload as never);
	const request = new Request("https://app.test/api/webhooks/payments", {
		method: "POST",
		headers: {
			"webhook-id": "wh_test",
			"webhook-timestamp": "123",
			"webhook-signature": "test",
		},
		body: "{}",
	});
	return polarPaymentProvider.parseWebhook(request);
}

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

	it("createCheckoutLink keeps owner metadata authoritative over input.metadata", async () => {
		checkoutsCreate.mockClear();
		await polarPaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
			organizationId: "org_123",
			metadata: {
				user_id: "attacker_user",
				organization_id: "attacker_org",
				extra: "kept",
			},
		});
		const params = checkoutsCreate.mock.calls[0]?.[0];
		expect(params.metadata).toMatchObject({
			user_id: "user_123",
			organization_id: "org_123",
			extra: "kept",
		});
	});

	it("createCheckoutLink passes seats through for seat-based pricing", async () => {
		checkoutsCreate.mockClear();
		await polarPaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
			seats: 4,
		});
		const params = checkoutsCreate.mock.calls[0]?.[0];
		expect(params.seats).toBe(4);
	});

	it("createCheckoutLink throws WebhookConfigError when no success URL is available", async () => {
		const original = env.POLAR_SUCCESS_URL;
		Object.assign(env, { POLAR_SUCCESS_URL: undefined });
		checkoutsCreate.mockClear();
		try {
			const err = await polarPaymentProvider
				.createCheckoutLink({ priceId: "price_abc" })
				.catch((e: unknown) => e);
			expect(err).toBeInstanceOf(WebhookConfigError);
			expect(checkoutsCreate).not.toHaveBeenCalled();
		} finally {
			Object.assign(env, { POLAR_SUCCESS_URL: original });
		}
	});

	it("createCheckoutLink throws WebhookConfigError on a relative success URL", async () => {
		checkoutsCreate.mockClear();
		const err = await polarPaymentProvider
			.createCheckoutLink({ priceId: "price_abc", successUrl: "/done" })
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(WebhookConfigError);
		expect(checkoutsCreate).not.toHaveBeenCalled();
	});

	it("createCustomerPortalLink calls customerSessions.create and returns the url", async () => {
		customerSessionsCreate.mockClear();
		const result = await polarPaymentProvider.createCustomerPortalLink({
			customerId: "cust_123",
		});
		expect(result.url).toBe("https://portal.test/url");
		expect(customerSessionsCreate).toHaveBeenCalledOnce();
	});

	it("createCustomerPortalLink passes returnUrl through to the session", async () => {
		customerSessionsCreate.mockClear();
		await polarPaymentProvider.createCustomerPortalLink({
			customerId: "cust_123",
			returnUrl: "https://app.test/settings",
		});
		const params = customerSessionsCreate.mock.calls[0]?.[0];
		expect(params.returnUrl).toBe("https://app.test/settings");
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
		expect(events[0]?.status).toBe("ACTIVE");
		// user_id / organization_id live in data.metadata — not on the
		// event object itself.
		expect(events[0]?.metadata).toEqual({
			user_id: "user_123",
			organization_id: "org_123",
		});
		// Standard-webhooks delivery id is used as the dedup marker.
		expect(events[0]?.eventId).toBe("test");
	});

	it("parseWebhook throws WebhookSignatureError on invalid signature", async () => {
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
		const err = await polarPaymentProvider
			.parseWebhook(request)
			.catch((e: unknown) => e);
		expect(err).toBeInstanceOf(WebhookSignatureError);
		expect((err as Error).message).toContain("signature");
	});

	it("parseWebhook throws WebhookConfigError when the webhook secret is not configured", async () => {
		const original = env.POLAR_WEBHOOK_SECRET;
		Object.assign(env, { POLAR_WEBHOOK_SECRET: undefined });
		try {
			const request = new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: {
					"webhook-id": "test",
					"webhook-timestamp": "123",
					"webhook-signature": "test",
				},
				body: "{}",
			});
			const err = await polarPaymentProvider
				.parseWebhook(request)
				.catch((e: unknown) => e);
			expect(err).toBeInstanceOf(WebhookConfigError);
		} finally {
			Object.assign(env, { POLAR_WEBHOOK_SECRET: original });
		}
	});

	it("is seat-aware — Polar SDK supports seat updates on subscriptions", async () => {
		const { isSeatAware } = await import("../types");
		expect(isSeatAware(polarPaymentProvider)).toBe(true);
	});

	it("setSubscriptionSeats calls subscriptions.update with a seats payload", async () => {
		subscriptionsUpdate.mockClear();
		await polarPaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_123",
			seats: 7,
		});
		expect(subscriptionsUpdate).toHaveBeenCalledWith({
			id: "sub_123",
			subscriptionUpdate: { seats: 7 },
		});
	});
});

describe("polar provider — event mapping", () => {
	it("maps checkout.updated with status succeeded to checkout.completed", async () => {
		const events = await parsePayload({
			type: "checkout.updated",
			data: {
				id: "ch_1",
				status: "succeeded",
				customerId: "cust_1",
				productId: "prod_1",
				subscriptionId: null,
				metadata: { user_id: "user_1" },
			},
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "checkout.completed",
			productId: "prod_1",
			customerId: "cust_1",
		});
		expect(events[0]?.subscriptionId).toBeUndefined();
	});

	it("carries subscriptionId on a succeeded subscription checkout", async () => {
		const events = await parsePayload({
			type: "checkout.updated",
			data: {
				id: "ch_1",
				status: "succeeded",
				customerId: "cust_1",
				productId: "prod_1",
				subscriptionId: "sub_1",
			},
		});
		expect(events[0]).toMatchObject({
			type: "checkout.completed",
			subscriptionId: "sub_1",
		});
	});

	it("skips checkout.updated for non-succeeded statuses", async () => {
		for (const status of ["open", "confirmed", "expired", "failed"]) {
			const events = await parsePayload({
				type: "checkout.updated",
				data: { id: "ch_1", status },
			});
			expect(events).toEqual([]);
		}
	});

	it("maps order.paid with billingReason subscription_cycle to subscription.renewed", async () => {
		const events = await parsePayload({
			type: "order.paid",
			data: {
				id: "ord_1",
				billingReason: "subscription_cycle",
				subscriptionId: "sub_9",
				checkoutId: null,
				customerId: "cust_1",
				productId: "prod_1",
			},
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "subscription.renewed",
			subscriptionId: "sub_9",
			customerId: "cust_1",
		});
	});

	it("maps order.paid with billingReason purchase to one_time.purchased when no checkout produced it", async () => {
		const events = await parsePayload({
			type: "order.paid",
			data: {
				id: "ord_1",
				billingReason: "purchase",
				subscriptionId: null,
				checkoutId: null,
				customerId: "cust_1",
				productId: "prod_topup",
			},
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "one_time.purchased",
			productId: "prod_topup",
		});
		expect(events[0]?.subscriptionId).toBeUndefined();
	});

	it("skips order.paid for a hosted-checkout order — checkout.updated already emitted checkout.completed", async () => {
		const events = await parsePayload({
			type: "order.paid",
			data: {
				id: "ord_1",
				billingReason: "purchase",
				subscriptionId: null,
				checkoutId: "ch_9",
				customerId: "cust_1",
				productId: "prod_topup",
			},
		});
		expect(events).toEqual([]);
	});

	it("treats order.paid without a subscriptionId as a one-time purchase even for other billing reasons", async () => {
		const events = await parsePayload({
			type: "order.paid",
			data: {
				id: "ord_1",
				billingReason: "subscription_update",
				subscriptionId: null,
				checkoutId: null,
				customerId: "cust_1",
				productId: "prod_1",
			},
		});
		expect(events[0]?.type).toBe("one_time.purchased");
	});

	it("skips order.paid for subscription_create — covered by subscription.active", async () => {
		const events = await parsePayload({
			type: "order.paid",
			data: {
				id: "ord_1",
				billingReason: "subscription_create",
				subscriptionId: "sub_1",
				checkoutId: null,
				customerId: "cust_1",
				productId: "prod_1",
			},
		});
		expect(events).toEqual([]);
	});

	it("falls back to the order's product.id when productId is null", async () => {
		const events = await parsePayload({
			type: "order.paid",
			data: {
				id: "ord_1",
				billingReason: "purchase",
				subscriptionId: null,
				checkoutId: null,
				customerId: "cust_1",
				productId: null,
				product: { id: "prod_from_object" },
			},
		});
		expect(events[0]).toMatchObject({
			type: "one_time.purchased",
			productId: "prod_from_object",
		});
	});

	it("maps subscription.active to subscription.activated with ACTIVE status", async () => {
		const events = await parsePayload({
			type: "subscription.active",
			data: {
				id: "sub_1",
				status: "active",
				customerId: "cust_1",
				productId: "prod_1",
				currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
			},
		});
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			type: "subscription.activated",
			subscriptionId: "sub_1",
			status: "ACTIVE",
		});
		expect(events[0]?.currentPeriodEnd).toEqual(
			new Date("2027-01-01T00:00:00.000Z"),
		);
	});

	it("ignores subscription.created — fires pre-payment, subscription.active is the activation signal", async () => {
		const events = await parsePayload({
			type: "subscription.created",
			data: {
				id: "sub_1",
				status: "incomplete",
				customerId: "cust_1",
				productId: "prod_1",
			},
		});
		expect(events).toEqual([]);
	});

	it("maps subscription.past_due with PAST_DUE status", async () => {
		const events = await parsePayload({
			type: "subscription.past_due",
			data: { id: "sub_1", status: "past_due", customerId: "cust_1" },
		});
		expect(events[0]).toMatchObject({
			type: "subscription.past_due",
			subscriptionId: "sub_1",
			status: "PAST_DUE",
		});
	});

	it("maps subscription.paused with PAUSED status", async () => {
		const events = await parsePayload({
			type: "subscription.paused",
			data: { id: "sub_1", status: "paused", customerId: "cust_1" },
		});
		expect(events[0]).toMatchObject({
			type: "subscription.paused",
			status: "PAUSED",
		});
	});

	it("maps subscription.resumed to subscription.activated", async () => {
		const events = await parsePayload({
			type: "subscription.resumed",
			data: { id: "sub_1", status: "active", customerId: "cust_1" },
		});
		expect(events[0]).toMatchObject({
			type: "subscription.activated",
			status: "ACTIVE",
		});
	});

	it("maps subscription.canceled with cancelAtPeriodEnd to scheduled_cancel", async () => {
		const events = await parsePayload({
			type: "subscription.canceled",
			data: {
				id: "sub_1",
				status: "active",
				cancelAtPeriodEnd: true,
				currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
				customerId: "cust_1",
			},
		});
		expect(events[0]).toMatchObject({
			type: "subscription.scheduled_cancel",
			status: "SCHEDULED_CANCEL",
		});
	});

	it("maps subscription.canceled without the period-end flag to canceled", async () => {
		const events = await parsePayload({
			type: "subscription.canceled",
			data: {
				id: "sub_1",
				status: "canceled",
				cancelAtPeriodEnd: false,
				customerId: "cust_1",
			},
		});
		expect(events[0]).toMatchObject({
			type: "subscription.canceled",
			status: "CANCELED",
		});
	});

	it("maps subscription.uncanceled to subscription.updated", async () => {
		const events = await parsePayload({
			type: "subscription.uncanceled",
			data: { id: "sub_1", status: "active", customerId: "cust_1" },
		});
		expect(events[0]).toMatchObject({ type: "subscription.updated" });
	});

	it("maps subscription.revoked to subscription.expired with EXPIRED status", async () => {
		const events = await parsePayload({
			type: "subscription.revoked",
			data: {
				id: "sub_1",
				status: "canceled",
				endsAt: new Date("2026-06-01T00:00:00.000Z"),
				customerId: "cust_1",
			},
		});
		expect(events[0]).toMatchObject({
			type: "subscription.expired",
			status: "EXPIRED",
		});
		expect(events[0]?.currentPeriodEnd).toEqual(
			new Date("2026-06-01T00:00:00.000Z"),
		);
	});

	it("ignores unmapped Polar event types", async () => {
		const events = await parsePayload({
			type: "customer.created",
			data: { id: "cust_1" },
		});
		expect(events).toEqual([]);
	});

	it("acks unmapped event types without parsing data — a missing id must not 400 into infinite provider retries", async () => {
		// Valid signed events of types we don't map carry payload shapes our
		// strict data schema doesn't guarantee (e.g. no `id`). Rejecting them
		// made the webhook handler answer 400 and Polar retried forever.
		const events = await parsePayload({
			type: "benefit_grant.created",
			data: { grantMetadata: { foo: "bar" } },
		});
		expect(events).toEqual([]);
	});
});

describe("polar provider — SDK validation errors", () => {
	it("returns [] when the SDK rejects an event type it does not know yet", async () => {
		const { validateEvent } = await import("@polar-sh/sdk/webhooks");
		const { SDKValidationError } = await import(
			"@polar-sh/sdk/models/errors/sdkvalidationerror.js"
		);
		vi.mocked(validateEvent).mockImplementationOnce(() => {
			// Mirrors the SDK's parseEvent: the "Unknown event type" throw is
			// wrapped inside the generic "Failed to parse event" error.
			throw new SDKValidationError(
				"Failed to parse event",
				new SDKValidationError(
					"Unknown event type: thing.happened",
					"thing.happened",
					{ type: "thing.happened" },
				),
				{ type: "thing.happened" },
			);
		});
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"webhook-id": "wh_test",
				"webhook-timestamp": "123",
				"webhook-signature": "test",
			},
			body: "{}",
		});
		const events = await polarPaymentProvider.parseWebhook(request);
		expect(events).toEqual([]);
	});

	it("throws a malformed-payload error when the SDK rejects a known event's shape", async () => {
		const { validateEvent } = await import("@polar-sh/sdk/webhooks");
		const { SDKValidationError } = await import(
			"@polar-sh/sdk/models/errors/sdkvalidationerror.js"
		);
		vi.mocked(validateEvent).mockImplementationOnce(() => {
			throw new SDKValidationError(
				"Failed to parse event",
				new Error("zod schema mismatch"),
				{ type: "subscription.active", data: {} },
			);
		});
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: {
				"webhook-id": "wh_test",
				"webhook-timestamp": "123",
				"webhook-signature": "test",
			},
			body: "{}",
		});
		await expect(polarPaymentProvider.parseWebhook(request)).rejects.toThrow(
			"Malformed webhook payload",
		);
	});
});
