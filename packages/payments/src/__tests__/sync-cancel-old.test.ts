import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider, ProviderEvent } from "../types";

const mockCreatePurchase = vi.fn();
const mockUpdatePurchase = vi.fn();
const mockGetPurchasesByUserId = vi.fn();

vi.mock("@fuutu/db", () => ({
	createPurchase: mockCreatePurchase,
	updatePurchase: mockUpdatePurchase,
	getPurchaseByProviderSubscriptionId: vi.fn().mockResolvedValue(null),
	getPurchaseByCheckoutEventId: vi.fn(),
	getPurchasesByOrganizationId: vi.fn().mockResolvedValue([]),
	getPurchasesByUserId: mockGetPurchasesByUserId,
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
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

const mockLogWarn = vi.hoisted(() => vi.fn());
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: mockLogWarn,
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/env/saas", () => ({ env: { NODE_ENV: "test" } }));
vi.mock("@fuutu/webhooks", () => ({ dispatchEvent: vi.fn() }));

function fakeProvider(id: string): PaymentProvider {
	return {
		id,
		createCheckoutLink: vi.fn(),
		createCustomerPortalLink: vi.fn(),
		createCustomer: vi.fn(),
		cancelSubscription: vi.fn().mockResolvedValue(undefined),
		parseWebhook: vi.fn(),
	};
}

const providers = vi.hoisted(() => ({
	byId: {} as Record<string, PaymentProvider>,
	activeId: "stripe",
}));

vi.mock("../resolve", () => ({
	resolvePaymentProvider: () => providers.byId[providers.activeId],
	resolvePaymentProviderById: (id: string) => providers.byId[id] ?? null,
}));

const { processWebhookEvents } = await import("../sync");

const activation = (subscriptionId: string): ProviderEvent => ({
	type: "subscription.activated",
	subscriptionId,
	productId: "price_new",
	status: "ACTIVE",
	metadata: { user_id: "user_1" },
});

const oldSub = (provider: string, subscriptionId: string) => ({
	id: `purchase_${subscriptionId}`,
	type: "SUBSCRIPTION",
	provider,
	subscriptionId,
	status: "ACTIVE",
});

describe("upgrade across a provider switch", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		providers.byId = {
			stripe: fakeProvider("stripe"),
			polar: fakeProvider("polar"),
		};
		providers.activeId = "stripe";
	});

	it("cancels an old subscription through the provider that owns it", async () => {
		mockGetPurchasesByUserId.mockResolvedValue([oldSub("polar", "sub_polar")]);

		await processWebhookEvents("stripe", [activation("sub_stripe_new")]);

		expect(providers.byId.polar?.cancelSubscription).toHaveBeenCalledWith(
			"sub_polar",
		);
		expect(providers.byId.stripe?.cancelSubscription).not.toHaveBeenCalled();
		expect(mockUpdatePurchase).toHaveBeenCalledWith({
			id: "purchase_sub_polar",
			status: "CANCELED",
		});
	});

	it("cancels a same-provider old subscription through that provider", async () => {
		mockGetPurchasesByUserId.mockResolvedValue([
			oldSub("stripe", "sub_stripe_old"),
		]);

		await processWebhookEvents("stripe", [activation("sub_stripe_new")]);

		expect(providers.byId.stripe?.cancelSubscription).toHaveBeenCalledWith(
			"sub_stripe_old",
		);
	});

	it("never calls another provider for a subscription whose provider cannot be resolved", async () => {
		mockGetPurchasesByUserId.mockResolvedValue([
			oldSub("lemonsqueezy", "sub_ls"),
		]);

		await processWebhookEvents("stripe", [activation("sub_stripe_new")]);

		expect(providers.byId.stripe?.cancelSubscription).not.toHaveBeenCalled();
		expect(providers.byId.polar?.cancelSubscription).not.toHaveBeenCalled();
		expect(mockLogWarn).toHaveBeenCalledWith(
			expect.stringContaining("provider"),
			expect.objectContaining({ subscriptionProvider: "lemonsqueezy" }),
		);
	});
});
