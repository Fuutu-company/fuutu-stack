import { env } from "@fuutu/env/saas";
import { describe, expect, it, vi } from "vitest";
import {
	isProviderRequestError,
	WebhookConfigError,
	WebhookSignatureError,
} from "../types";

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
const invoicePaymentsList = vi.fn().mockResolvedValue({ data: [] });
const invoicesRetrieve = vi.fn();
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

vi.mock("stripe", async () => {
	// The SDK's own API error classes, so failures carry the real type,
	// statusCode and code fields.
	const actual = await vi.importActual<typeof import("stripe")>("stripe");
	const errors = {
		...actual.default.errors,
		StripeSignatureVerificationError: MockStripeSignatureVerificationError,
	};
	return {
		default: class MockStripe {
			static errors = errors;
			checkout = { sessions: { create: checkoutCreate, listLineItems } };
			billingPortal = { sessions: { create: portalCreate } };
			customers = { create: customersCreate };
			subscriptions = {
				cancel: subscriptionsCancel,
				retrieve: subscriptionsRetrieve,
				update: subscriptionsUpdate,
			};
			webhooks = { constructEventAsync: webhooksConstructEventAsync };
			invoicePayments = { list: invoicePaymentsList };
			invoices = { retrieve: invoicesRetrieve };
		},
	};
});

vi.mock("@fuutu/env/saas", () => ({
	env: {
		STRIPE_SECRET_KEY: "test-stripe-key",
		STRIPE_WEBHOOK_SECRET: "test-webhook-secret",
		NEXT_PUBLIC_SAAS_URL: "https://app.test",
		NODE_ENV: "test",
	},
}));

const { stripePaymentProvider } = await import("../providers/stripe");
const { default: Stripe } = await import("stripe");

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

	it("createCheckoutLink passes trialDays as subscription_data.trial_period_days", async () => {
		checkoutCreate.mockClear();
		await stripePaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
			trialDays: 14,
		});
		const params = checkoutCreate.mock.calls[0]?.[0];
		expect(params.subscription_data?.trial_period_days).toBe(14);
	});

	it("createCheckoutLink sets no trial when trialDays is absent", async () => {
		checkoutCreate.mockClear();
		await stripePaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
		});
		const params = checkoutCreate.mock.calls[0]?.[0];
		expect(params.subscription_data).not.toHaveProperty("trial_period_days");
	});

	it("createCheckoutLink ignores trialDays in payment mode", async () => {
		checkoutCreate.mockClear();
		await stripePaymentProvider.createCheckoutLink({
			priceId: "price_abc",
			userId: "user_123",
			trialDays: 14,
			metadata: { mode: "payment" },
		});
		const params = checkoutCreate.mock.calls[0]?.[0];
		expect(params.mode).toBe("payment");
		expect(params.subscription_data).toBeUndefined();
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
					payment_status: "paid",
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

	it("maps invoice.paid to subscription.renewed carrying invoice details", async () => {
		webhooksConstructEventAsync.mockResolvedValueOnce({
			type: "invoice.paid",
			id: "evt_inv_paid",
			data: {
				object: {
					id: "in_123",
					customer: "cust_123",
					status: "paid",
					amount_paid: 1900,
					currency: "usd",
					created: 1_700_000_000,
					hosted_invoice_url: "https://pay.stripe.com/invoice/in_123",
					invoice_pdf: "https://pay.stripe.com/invoice/in_123.pdf",
					period_end: 1_702_678_400,
					period_start: 1_700_000_000,
					status_transitions: { paid_at: 1_700_000_100 },
					parent: {
						type: "subscription_details",
						subscription_details: { subscription: "sub_123" },
					},
				},
			},
		} as never);
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "stripe-signature": "test" },
			body: "{}",
		});
		const events = await stripePaymentProvider.parseWebhook(request);
		expect(events[0]).toMatchObject({
			type: "subscription.renewed",
			eventId: "evt_inv_paid",
			subscriptionId: "sub_123",
			invoice: {
				id: "in_123",
				url: "https://pay.stripe.com/invoice/in_123",
				pdfUrl: "https://pay.stripe.com/invoice/in_123.pdf",
				amount: "19.00",
				currency: "USD",
				status: "paid",
				issuedAt: new Date(1_700_000_000 * 1000),
				paidAt: new Date(1_700_000_100 * 1000),
			},
		});
	});

	it("invoice.paid carries the new period end from the subscription line, not the billed period", async () => {
		// invoice.period_end is the end of the period just billed; the
		// subscription line's period is the one the payment starts.
		webhooksConstructEventAsync.mockResolvedValueOnce({
			type: "invoice.paid",
			id: "evt_inv_cycle",
			data: {
				object: {
					id: "in_cycle",
					customer: "cust_123",
					status: "paid",
					amount_paid: 1900,
					currency: "usd",
					created: 1_702_678_400,
					period_start: 1_700_000_000,
					period_end: 1_702_678_400,
					lines: {
						data: [{ period: { start: 1_702_678_400, end: 1_705_356_800 } }],
					},
					parent: {
						type: "subscription_details",
						subscription_details: { subscription: "sub_123" },
					},
				},
			},
		} as never);
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "stripe-signature": "test" },
			body: "{}",
		});
		const events = await stripePaymentProvider.parseWebhook(request);
		expect(events[0]?.currentPeriodEnd).toEqual(new Date(1_705_356_800 * 1000));
	});

	it("maps invoice.payment_failed to subscription.past_due carrying the open invoice", async () => {
		webhooksConstructEventAsync.mockResolvedValueOnce({
			type: "invoice.payment_failed",
			id: "evt_inv_failed",
			data: {
				object: {
					id: "in_456",
					customer: "cust_123",
					status: "open",
					amount_due: 1900,
					currency: "usd",
					created: 1_700_000_000,
					hosted_invoice_url: "https://pay.stripe.com/invoice/in_456",
					parent: {
						type: "subscription_details",
						subscription_details: { subscription: "sub_123" },
					},
				},
			},
		} as never);
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "stripe-signature": "test" },
			body: "{}",
		});
		const events = await stripePaymentProvider.parseWebhook(request);
		expect(events[0]).toMatchObject({
			type: "subscription.past_due",
			eventId: "evt_inv_failed",
			subscriptionId: "sub_123",
			status: "PAST_DUE",
			invoice: {
				id: "in_456",
				amount: "19.00",
				status: "open",
			},
		});
	});

	it("returns no events for invoice.paid without a subscription", async () => {
		webhooksConstructEventAsync.mockResolvedValueOnce({
			type: "invoice.paid",
			id: "evt_inv_orphan",
			data: {
				object: {
					id: "in_789",
					customer: "cust_123",
					status: "paid",
					amount_paid: 500,
					currency: "usd",
				},
			},
		} as never);
		const request = new Request("https://app.test/api/webhooks/payments", {
			method: "POST",
			headers: { "stripe-signature": "test" },
			body: "{}",
		});
		const events = await stripePaymentProvider.parseWebhook(request);
		expect(events).toEqual([]);
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

describe("stripe provider — getSubscriptionStatus", () => {
	it.each([
		["canceled", "CANCELED"],
		["active", "ACTIVE"],
		["past_due", "PAST_DUE"],
		// Terminal: the first invoice was never paid — nothing left to cancel.
		["incomplete_expired", "EXPIRED"],
		["incomplete", "INCOMPLETE"],
	])("maps a %s subscription to %s", async (status, expected) => {
		subscriptionsRetrieve.mockResolvedValueOnce({ id: "sub_1", status });
		await expect(
			stripePaymentProvider.getSubscriptionStatus?.("sub_1"),
		).resolves.toBe(expected);
		expect(subscriptionsRetrieve).toHaveBeenLastCalledWith("sub_1");
	});

	it("throws when the lookup fails", async () => {
		subscriptionsRetrieve.mockRejectedValueOnce(new Error("stripe down"));
		await expect(
			stripePaymentProvider.getSubscriptionStatus?.("sub_1"),
		).rejects.toThrow("stripe down");
	});
});

describe("stripe provider — purchased units", () => {
	function parseEvent(event: unknown) {
		webhooksConstructEventAsync.mockResolvedValueOnce(event as never);
		return stripePaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "stripe-signature": "test" },
				body: "{}",
			}),
		);
	}

	it.each([
		["customer.subscription.created", "subscription.activated"],
		["customer.subscription.updated", "subscription.updated"],
	])("reads the subscription item quantity on %s", async (type, mapped) => {
		const events = await parseEvent({
			type,
			id: "evt_1",
			data: {
				object: {
					id: "sub_1",
					customer: "cust_1",
					status: "active",
					metadata: {},
					items: {
						data: [
							{
								price: { id: "price_1" },
								quantity: 7,
								current_period_end: 1_700_000_000,
							},
						],
					},
				},
			},
		});
		expect(events[0]).toMatchObject({ type: mapped, units: 7 });
	});

	it("reads the line item quantity on a one-time checkout", async () => {
		listLineItems.mockResolvedValueOnce({
			data: [{ price: { id: "price_topup" }, quantity: 2 }],
		});
		const events = await parseEvent({
			type: "checkout.session.completed",
			id: "evt_2",
			data: {
				object: {
					id: "cs_1",
					subscription: null,
					payment_status: "paid",
					customer: "cust_1",
					metadata: { user_id: "user_1" },
				},
			},
		});
		expect(events[0]?.units).toBe(2);
	});

	it.each([[0], [-3], [1.5], [null]])(
		"drops a non-positive-integer subscription quantity (%s)",
		async (quantity) => {
			const events = await parseEvent({
				type: "customer.subscription.updated",
				id: "evt_3",
				data: {
					object: {
						id: "sub_1",
						customer: "cust_1",
						status: "active",
						metadata: {},
						items: {
							data: [
								{
									price: { id: "price_1" },
									quantity,
									current_period_end: 1_700_000_000,
								},
							],
						},
					},
				},
			});
			expect(events[0]?.type).toBe("subscription.updated");
			expect(events[0]?.units).toBeUndefined();
		},
	);

	it.each([[0], [-1], [2.5]])(
		"drops a non-positive-integer line item quantity (%s)",
		async (quantity) => {
			listLineItems.mockResolvedValueOnce({
				data: [{ price: { id: "price_topup" }, quantity }],
			});
			const events = await parseEvent({
				type: "checkout.session.completed",
				id: "evt_4",
				data: {
					object: {
						id: "cs_1",
						subscription: null,
						payment_status: "paid",
						customer: "cust_1",
						metadata: { user_id: "user_1" },
					},
				},
			});
			expect(events[0]?.productId).toBe("price_topup");
			expect(events[0]?.units).toBeUndefined();
		},
	);
});

describe("stripe provider — per-call seat proration", () => {
	it.each([
		["charge-immediately", "always_invoice"],
		["none", "none"],
	] as const)(
		"proration %s sends proration_behavior %s",
		async (proration, expected) => {
			subscriptionsUpdate.mockClear();
			await stripePaymentProvider.setSubscriptionSeats({
				subscriptionId: "sub_123",
				seats: 5,
				proration,
			});
			expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
				items: [{ id: "item_123", quantity: 5 }],
				proration_behavior: expected,
			});
		},
	);

	it("without proration it keeps the account default (no proration_behavior)", async () => {
		subscriptionsUpdate.mockClear();
		await stripePaymentProvider.setSubscriptionSeats({
			subscriptionId: "sub_123",
			seats: 5,
		});
		expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
			items: [{ id: "item_123", quantity: 5 }],
		});
	});
});

describe("stripe provider — cancel at period end and resume", () => {
	it("cancel with atPeriodEnd sets cancel_at_period_end instead of canceling", async () => {
		subscriptionsCancel.mockClear();
		subscriptionsUpdate.mockClear();
		await stripePaymentProvider.cancelSubscription("sub_123", {
			atPeriodEnd: true,
		});
		expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
			cancel_at_period_end: true,
		});
		expect(subscriptionsCancel).not.toHaveBeenCalled();
	});

	it("cancel with mode period_end sets cancel_at_period_end", async () => {
		subscriptionsCancel.mockClear();
		subscriptionsUpdate.mockClear();
		await stripePaymentProvider.cancelSubscription("sub_123", {
			mode: "period_end",
		});
		expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
			cancel_at_period_end: true,
		});
		expect(subscriptionsCancel).not.toHaveBeenCalled();
	});

	it("cancel with mode immediate cancels now, whatever atPeriodEnd says", async () => {
		subscriptionsCancel.mockClear();
		subscriptionsUpdate.mockClear();
		await stripePaymentProvider.cancelSubscription("sub_123", {
			mode: "immediate",
			atPeriodEnd: true,
		});
		expect(subscriptionsCancel).toHaveBeenCalledWith("sub_123");
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("cancel without options cancels immediately, as before", async () => {
		subscriptionsCancel.mockClear();
		subscriptionsUpdate.mockClear();
		await stripePaymentProvider.cancelSubscription("sub_123");
		expect(subscriptionsCancel).toHaveBeenCalledWith("sub_123");
		expect(subscriptionsUpdate).not.toHaveBeenCalled();
	});

	it("resumeSubscription clears cancel_at_period_end", async () => {
		subscriptionsUpdate.mockClear();
		await stripePaymentProvider.resumeSubscription?.("sub_123");
		expect(subscriptionsUpdate).toHaveBeenCalledWith("sub_123", {
			cancel_at_period_end: false,
		});
	});
});

describe("stripe provider — scheduled cancel status", () => {
	function parseEvent(event: unknown) {
		webhooksConstructEventAsync.mockResolvedValueOnce(event as never);
		return stripePaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "stripe-signature": "test" },
				body: "{}",
			}),
		);
	}

	const subscription = (overrides: Record<string, unknown>) => ({
		id: "sub_1",
		customer: "cust_1",
		status: "active",
		metadata: {},
		items: {
			data: [{ price: { id: "price_1" }, current_period_end: 1_700_000_000 }],
		},
		...overrides,
	});

	it.each([
		[{ cancel_at_period_end: true }, "SCHEDULED_CANCEL"],
		[{ cancel_at: 1_700_000_000 }, "SCHEDULED_CANCEL"],
		[{ cancel_at_period_end: false, cancel_at: null }, "ACTIVE"],
	])("getSubscriptionStatus with %o reports %s", async (flags, expected) => {
		subscriptionsRetrieve.mockResolvedValueOnce(subscription(flags));
		await expect(
			stripePaymentProvider.getSubscriptionStatus?.("sub_1"),
		).resolves.toBe(expected);
	});

	it("customer.subscription.updated with cancel_at_period_end maps to SCHEDULED_CANCEL", async () => {
		const events = await parseEvent({
			type: "customer.subscription.updated",
			id: "evt_sc",
			data: { object: subscription({ cancel_at_period_end: true }) },
		});
		expect(events[0]).toMatchObject({
			type: "subscription.updated",
			status: "SCHEDULED_CANCEL",
		});
	});

	it("customer.subscription.updated without a scheduled cancel stays ACTIVE (resume)", async () => {
		const events = await parseEvent({
			type: "customer.subscription.updated",
			id: "evt_res",
			data: { object: subscription({ cancel_at_period_end: false }) },
		});
		expect(events[0]?.status).toBe("ACTIVE");
	});

	it("a past-due subscription keeps PAST_DUE even with a scheduled cancel", async () => {
		subscriptionsRetrieve.mockResolvedValueOnce(
			subscription({ status: "past_due", cancel_at_period_end: true }),
		);
		await expect(
			stripePaymentProvider.getSubscriptionStatus?.("sub_1"),
		).resolves.toBe("PAST_DUE");
	});
});

const { testPaymentProviderContract } = await import("./provider-contract");
testPaymentProviderContract("stripe", () => stripePaymentProvider, {
	behavior: "shape",
});

describe("stripe provider — getSubscriptionSeats", () => {
	it("reads the quantity of the subscription's item", async () => {
		subscriptionsRetrieve.mockResolvedValueOnce({
			id: "sub_1",
			items: { data: [{ id: "item_1", quantity: 7 }] },
		});
		await expect(
			stripePaymentProvider.getSubscriptionSeats?.("sub_1"),
		).resolves.toBe(7);
		expect(subscriptionsRetrieve).toHaveBeenLastCalledWith("sub_1");
	});

	it("fails closed for an item without a quantity (metered prices have none)", async () => {
		subscriptionsRetrieve.mockResolvedValueOnce({
			id: "sub_1",
			items: { data: [{ id: "item_1" }] },
		});
		await expect(
			stripePaymentProvider.getSubscriptionSeats?.("sub_1"),
		).rejects.toThrow();
	});

	it("fails closed when the lookup fails or the subscription has no item", async () => {
		subscriptionsRetrieve.mockRejectedValueOnce(new Error("stripe down"));
		await expect(
			stripePaymentProvider.getSubscriptionSeats?.("sub_1"),
		).rejects.toThrow("stripe down");

		subscriptionsRetrieve.mockResolvedValueOnce({
			id: "sub_1",
			items: { data: [] },
		});
		await expect(
			stripePaymentProvider.getSubscriptionSeats?.("sub_1"),
		).rejects.toThrow();
	});
});

describe("stripe provider — typed API failures", () => {
	const { errors } = Stripe;
	const raw = (over: Record<string, unknown>) => ({
		message: "Stripe says no",
		...over,
	});

	it.each([
		[
			"an unknown subscription",
			"not_found",
			new errors.StripeInvalidRequestError(
				raw({ statusCode: 404, code: "resource_missing" }),
			),
		],
		[
			"a change a canceled subscription refuses",
			"invalid_state",
			new errors.StripeInvalidRequestError(
				raw({
					statusCode: 400,
					message:
						"A canceled subscription can only update its cancellation_details and metadata.",
				}),
			),
		],
		[
			"a request Stripe refuses",
			"rejected",
			new errors.StripeInvalidRequestError(
				raw({ statusCode: 400, code: "parameter_invalid_integer" }),
			),
		],
		[
			"a declined card",
			"rejected",
			new errors.StripeCardError(
				raw({ statusCode: 402, code: "card_declined" }),
			),
		],
		[
			"a Stripe outage",
			"unavailable",
			new errors.StripeAPIError(raw({ statusCode: 500 })),
		],
		[
			"a rate limit",
			"unavailable",
			new errors.StripeRateLimitError(raw({ statusCode: 429 })),
		],
		[
			"a network failure",
			"unavailable",
			new errors.StripeConnectionError(raw({})),
		],
	] as const)(
		"%s is a ProviderRequestError of kind %s",
		async (_, kind, err) => {
			subscriptionsCancel.mockRejectedValueOnce(err);
			const failure = await stripePaymentProvider
				.cancelSubscription("sub_123")
				.catch((e: unknown) => e);
			expect(isProviderRequestError(failure)).toBe(true);
			expect(failure).toMatchObject({
				kind,
				message: "Failed to cancel subscription",
			});
		},
	);

	it.each([
		new errors.StripeAuthenticationError(raw({ statusCode: 401 })),
		new errors.StripePermissionError(raw({ statusCode: 403 })),
	])(
		"a rejected API key ($statusCode) is a configuration error",
		async (err) => {
			subscriptionsUpdate.mockRejectedValueOnce(err);
			await expect(
				stripePaymentProvider.resumeSubscription?.("sub_123"),
			).rejects.toBeInstanceOf(WebhookConfigError);
		},
	);

	it("every Stripe call classifies its failure", async () => {
		const missing = () =>
			new errors.StripeInvalidRequestError(
				raw({ statusCode: 404, code: "resource_missing" }),
			);
		checkoutCreate.mockRejectedValueOnce(missing());
		await expect(
			stripePaymentProvider.createCheckoutLink({ priceId: "price_x" }),
		).rejects.toMatchObject({ kind: "not_found" });
		portalCreate.mockRejectedValueOnce(missing());
		await expect(
			stripePaymentProvider.createCustomerPortalLink({ customerId: "cus_x" }),
		).rejects.toMatchObject({ kind: "not_found" });
		customersCreate.mockRejectedValueOnce(missing());
		await expect(
			stripePaymentProvider.createCustomer({
				userId: "u",
				email: "u@example.com",
			}),
		).rejects.toMatchObject({ kind: "not_found" });
		subscriptionsRetrieve.mockRejectedValueOnce(missing());
		await expect(
			stripePaymentProvider.getSubscriptionStatus?.("sub_x"),
		).rejects.toMatchObject({ kind: "not_found" });
		subscriptionsRetrieve.mockRejectedValueOnce(missing());
		await expect(
			stripePaymentProvider.getSubscriptionSeats?.("sub_x"),
		).rejects.toMatchObject({ kind: "not_found" });
		subscriptionsRetrieve.mockRejectedValueOnce(missing());
		await expect(
			stripePaymentProvider.setSubscriptionSeats({
				subscriptionId: "sub_x",
				seats: 2,
			}),
		).rejects.toMatchObject({ kind: "not_found" });
	});

	it("an error that is not from Stripe is rethrown unchanged", async () => {
		const own = new Error("boom");
		subscriptionsCancel.mockRejectedValueOnce(own);
		await expect(
			stripePaymentProvider.cancelSubscription("sub_123"),
		).rejects.toBe(own);
	});

	it("does not end a trial on cancel (cancel at period end waits for the trial end)", () => {
		expect(stripePaymentProvider.cancelEndsTrial).toBeFalsy();
	});
});

describe("stripe provider — checkout payment status", () => {
	function parseEvent(event: unknown) {
		webhooksConstructEventAsync.mockResolvedValueOnce(event as never);
		return stripePaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "stripe-signature": "test" },
				body: "{}",
			}),
		);
	}

	const oneTimeSession = (payment_status: string) => ({
		id: "cs_async",
		subscription: null,
		customer: "cust_1",
		payment_status,
		metadata: { user_id: "user_1" },
	});

	it("ignores a one-time checkout that completed unpaid (SEPA/ACH still processing)", async () => {
		listLineItems.mockClear();
		const events = await parseEvent({
			type: "checkout.session.completed",
			id: "evt_unpaid",
			data: { object: oneTimeSession("unpaid") },
		});
		expect(events).toEqual([]);
		expect(listLineItems).not.toHaveBeenCalled();
	});

	it("ignores a subscription checkout that completed unpaid", async () => {
		const events = await parseEvent({
			type: "checkout.session.completed",
			id: "evt_unpaid_sub",
			data: {
				object: {
					id: "cs_sub",
					subscription: "sub_1",
					customer: "cust_1",
					payment_status: "unpaid",
					metadata: { organization_id: "org_1" },
				},
			},
		});
		expect(events).toEqual([]);
	});

	it("fails closed on a session without a payment status", async () => {
		const events = await parseEvent({
			type: "checkout.session.completed",
			id: "evt_nostatus",
			data: {
				object: {
					id: "cs_x",
					subscription: null,
					customer: "cust_1",
					metadata: { user_id: "user_1" },
				},
			},
		});
		expect(events).toEqual([]);
	});

	it("processes a checkout with no payment required (100% discount)", async () => {
		listLineItems.mockResolvedValueOnce({
			data: [{ price: { id: "price_topup" }, quantity: 1 }],
		});
		const events = await parseEvent({
			type: "checkout.session.completed",
			id: "evt_free",
			data: { object: oneTimeSession("no_payment_required") },
		});
		expect(events[0]).toMatchObject({
			type: "checkout.completed",
			productId: "price_topup",
		});
	});

	it("maps checkout.session.async_payment_succeeded to checkout.completed", async () => {
		listLineItems.mockResolvedValueOnce({
			data: [{ price: { id: "price_topup" }, quantity: 1 }],
		});
		const events = await parseEvent({
			type: "checkout.session.async_payment_succeeded",
			id: "evt_async_ok",
			data: { object: oneTimeSession("paid") },
		});
		expect(events).toEqual([
			expect.objectContaining({
				type: "checkout.completed",
				eventId: "evt_async_ok",
				productId: "price_topup",
				metadata: { user_id: "user_1" },
			}),
		]);
	});

	it("ignores checkout.session.async_payment_failed", async () => {
		const events = await parseEvent({
			type: "checkout.session.async_payment_failed",
			id: "evt_async_fail",
			data: { object: oneTimeSession("unpaid") },
		});
		expect(events).toEqual([]);
	});
});

describe("stripe provider — refunds and disputes", () => {
	function parseEvent(event: unknown) {
		webhooksConstructEventAsync.mockResolvedValueOnce(event as never);
		return stripePaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "stripe-signature": "test" },
				body: "{}",
			}),
		);
	}

	const charge = (overrides: Record<string, unknown> = {}) => ({
		id: "ch_1",
		payment_intent: "pi_1",
		refunded: true,
		amount: 1900,
		amount_refunded: 1900,
		...overrides,
	});

	it("stores the payment intent as the payment reference of a one-time checkout", async () => {
		listLineItems.mockResolvedValueOnce({
			data: [{ price: { id: "price_topup" }, quantity: 1 }],
		});
		const events = await parseEvent({
			type: "checkout.session.completed",
			id: "evt_paid",
			data: {
				object: {
					id: "cs_1",
					subscription: null,
					payment_status: "paid",
					payment_intent: "pi_1",
					customer: "cust_1",
					metadata: { user_id: "user_1" },
				},
			},
		});
		expect(events[0]?.paymentRef).toBe("pi_1");
	});

	it("maps a full refund of a one-time payment to payment.reversed by payment intent", async () => {
		invoicePaymentsList.mockResolvedValueOnce({ data: [] });
		const events = await parseEvent({
			type: "charge.refunded",
			id: "evt_refund",
			data: { object: charge() },
		});
		expect(invoicePaymentsList).toHaveBeenCalledWith({
			payment: { type: "payment_intent", payment_intent: "pi_1" },
			limit: 1,
		});
		expect(events).toEqual([
			{ type: "payment.reversed", eventId: "evt_refund", paymentRef: "pi_1" },
		]);
	});

	it("maps a full refund of a subscription invoice to payment.reversed of that subscription", async () => {
		invoicePaymentsList.mockResolvedValueOnce({
			data: [{ invoice: "in_1" }],
		});
		invoicesRetrieve.mockResolvedValueOnce({
			id: "in_1",
			parent: {
				type: "subscription_details",
				subscription_details: { subscription: "sub_1" },
			},
		});
		const events = await parseEvent({
			type: "charge.refunded",
			id: "evt_refund_sub",
			data: { object: charge() },
		});
		expect(invoicesRetrieve).toHaveBeenCalledWith("in_1");
		expect(events).toEqual([
			{
				type: "payment.reversed",
				eventId: "evt_refund_sub",
				subscriptionId: "sub_1",
			},
		]);
	});

	it("ignores a partial refund", async () => {
		invoicePaymentsList.mockClear();
		const events = await parseEvent({
			type: "charge.refunded",
			id: "evt_partial",
			data: { object: charge({ refunded: false, amount_refunded: 500 }) },
		});
		expect(events).toEqual([]);
		expect(invoicePaymentsList).not.toHaveBeenCalled();
	});

	it("maps a dispute to payment.reversed", async () => {
		invoicePaymentsList.mockResolvedValueOnce({ data: [] });
		const events = await parseEvent({
			type: "charge.dispute.created",
			id: "evt_dispute",
			data: {
				object: { id: "dp_1", charge: "ch_1", payment_intent: "pi_9" },
			},
		});
		expect(events).toEqual([
			{ type: "payment.reversed", eventId: "evt_dispute", paymentRef: "pi_9" },
		]);
	});

	it("ignores a refund without a payment intent", async () => {
		const events = await parseEvent({
			type: "charge.refunded",
			id: "evt_nopi",
			data: { object: charge({ payment_intent: null }) },
		});
		expect(events).toEqual([]);
	});
});
