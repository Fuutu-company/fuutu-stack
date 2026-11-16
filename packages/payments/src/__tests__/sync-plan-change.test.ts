import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Plan switch inside one subscription, end to end from the provider
 * payload: the adapter reports the new product/price, sync must store it
 * as productId (what plan resolution reads) — not only as priceId.
 */

const webhooksConstructEventAsync = vi.hoisted(() => vi.fn());
vi.mock("stripe", () => ({
	default: class MockStripe {
		static errors = {
			StripeSignatureVerificationError: class extends Error {},
		};
		webhooks = { constructEventAsync: webhooksConstructEventAsync };
	},
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		NODE_ENV: "test",
		CREEM_API_KEY: "test-creem-key",
		CREEM_WEBHOOK_SECRET: "creem-secret",
		STRIPE_SECRET_KEY: "test-stripe-key",
		STRIPE_WEBHOOK_SECRET: "stripe-secret",
		NEXT_PUBLIC_SAAS_URL: "https://app.test",
	},
}));

const mockUpdatePurchase = vi.fn();
const mockGetPurchaseByProviderSubscriptionId = vi.fn();
vi.mock("@fuutu/db", () => ({
	createPurchase: vi.fn(),
	updatePurchase: mockUpdatePurchase,
	getPurchaseByProviderSubscriptionId: mockGetPurchaseByProviderSubscriptionId,
	getPurchaseByCheckoutEventId: vi.fn(),
	getPurchasesByOrganizationId: vi.fn().mockResolvedValue([]),
	getPurchasesByUserId: vi.fn().mockResolvedValue([]),
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
	getActiveSubscriptionsForOwner: vi.fn(),
	getActiveOneTimePlanPurchase: vi.fn(),
	getCreditBalance: vi.fn().mockResolvedValue(null),
	setPaymentsCustomerId: vi.fn(),
	setOrganizationPaymentsCustomerId: vi.fn(),
	upsertInvoiceByProviderId: vi.fn(),
	isUniqueViolation: () => false,
}));

vi.mock("@fuutu/credits", () => ({
	grantRecurringCredits: vi.fn(),
	grantTopUpCredits: vi.fn(),
	resetRecurringCredits: vi.fn(),
}));
vi.mock("@fuutu/webhooks", () => ({ dispatchEvent: vi.fn() }));
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

const { creemPaymentProvider } = await import("../providers/creem");
const { stripePaymentProvider } = await import("../providers/stripe");
const { processWebhookEvents } = await import("../sync");

beforeEach(() => {
	vi.clearAllMocks();
	mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
		id: "purchase_1",
		status: "ACTIVE",
		organizationId: "org_1",
		userId: null,
		metadata: {},
	});
});

describe("plan switch inside an existing subscription", () => {
	it("Creem subscription.update with a new product updates productId", async () => {
		const body = JSON.stringify({
			id: "evt_creem_1",
			eventType: "subscription.update",
			object: {
				id: "sub_creem_1",
				customer: { id: "cust_1" },
				product: { id: "prod_business" },
				status: "active",
				metadata: { organization_id: "org_1" },
			},
		});
		const signature = createHmac("sha256", "creem-secret")
			.update(body)
			.digest("hex");
		const events = await creemPaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "creem-signature": signature },
				body,
			}),
		);

		await processWebhookEvents("creem", events);

		expect(mockGetPurchaseByProviderSubscriptionId).toHaveBeenCalledWith(
			"creem",
			"sub_creem_1",
		);
		expect(mockUpdatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "purchase_1",
				productId: "prod_business",
				priceId: "prod_business",
			}),
		);
	});

	it("Stripe customer.subscription.updated with a new price updates productId", async () => {
		webhooksConstructEventAsync.mockResolvedValueOnce({
			id: "evt_stripe_1",
			type: "customer.subscription.updated",
			data: {
				object: {
					id: "sub_stripe_1",
					customer: "cus_1",
					status: "active",
					metadata: { organization_id: "org_1" },
					items: {
						data: [
							{
								price: { id: "price_business_monthly" },
								quantity: 3,
								current_period_end: 1_900_000_000,
							},
						],
					},
				},
			},
		});
		const events = await stripePaymentProvider.parseWebhook(
			new Request("https://app.test/api/webhooks/payments", {
				method: "POST",
				headers: { "stripe-signature": "t=1,v1=test" },
				body: "{}",
			}),
		);

		await processWebhookEvents("stripe", events);

		expect(mockUpdatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "purchase_1",
				productId: "price_business_monthly",
				priceId: "price_business_monthly",
				quantity: 3,
			}),
		);
	});
});
