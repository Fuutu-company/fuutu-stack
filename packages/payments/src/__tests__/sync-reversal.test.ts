import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider, ProviderEvent } from "../types";

// Refunds and disputes (`payment.reversed`) take back what the payment
// bought; a subscription that ends takes its unused recurring credits.

vi.mock("../config", async (importOriginal) => ({
	...(await importOriginal<typeof import("../config")>()),
	...(await import("@fuutu/test-utils")).planCatalogFixture,
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		NODE_ENV: "test",
		PAYMENTS_PRO_PRICE_ID: "price_pro",
		PAYMENTS_PRO_YEARLY_PRICE_ID: "price_pro_yearly",
	},
}));

const mockCreatePurchase = vi.fn();
const mockUpdatePurchase = vi.fn();
const mockGetPurchaseByProviderSubscriptionId = vi.fn();
const mockGetPurchasesByOrganizationId = vi.fn();
const mockGetActiveSubscriptionsForOwner = vi.fn();
const mockGetOneTimePurchaseByPaymentRef = vi.fn();

vi.mock("@fuutu/db", () => ({
	createPurchase: mockCreatePurchase,
	updatePurchase: mockUpdatePurchase,
	getPurchaseByProviderSubscriptionId: mockGetPurchaseByProviderSubscriptionId,
	getPurchaseByCheckoutEventId: vi.fn().mockResolvedValue(null),
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
	getPurchasesByUserId: vi.fn().mockResolvedValue([]),
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
	getActiveSubscriptionsForOwner: mockGetActiveSubscriptionsForOwner,
	getOneTimePurchaseByPaymentRef: mockGetOneTimePurchaseByPaymentRef,
	PURCHASE_PAYMENT_REF_KEY: "fuutu_payment_ref",
	getActiveOneTimePlanPurchase: vi.fn(),
	getCreditBalance: vi.fn().mockResolvedValue(null),
	setPaymentsCustomerId: vi.fn(),
	setOrganizationPaymentsCustomerId: vi.fn(),
	upsertInvoiceByProviderId: vi.fn(),
	isUniqueViolation: () => false,
}));

const mockRevokeRecurringCredits = vi.fn();
const mockRevokeTopUpCredits = vi.fn();
vi.mock("@fuutu/credits", () => ({
	grantRecurringCredits: vi.fn(),
	grantTopUpCredits: vi.fn(),
	resetRecurringCredits: vi.fn(),
	revokeRecurringCredits: mockRevokeRecurringCredits,
	revokeTopUpCredits: mockRevokeTopUpCredits,
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

const mockDispatchEvent = vi.fn();
vi.mock("@fuutu/webhooks", () => ({ dispatchEvent: mockDispatchEvent }));

const provider = vi.hoisted(() => ({
	current: null as PaymentProvider | null,
}));
vi.mock("../resolve", () => ({
	resolvePaymentProvider: () => provider.current,
	resolvePaymentProviderById: (id: string) =>
		provider.current?.id === id ? provider.current : null,
}));

const { processWebhookEvents } = await import("../sync");

const ORG = "org_1";
const DAY = 86_400_000;

const subscriptionRow = (overrides: Record<string, unknown> = {}) => ({
	id: "purchase_sub",
	type: "SUBSCRIPTION",
	provider: "stripe",
	subscriptionId: "sub_1",
	productId: "price_pro",
	priceId: "price_pro",
	organizationId: ORG,
	userId: null,
	status: "ACTIVE",
	currentPeriodEnd: new Date(Date.now() + 10 * DAY),
	metadata: { organization_id: ORG, user_id: "user_1" },
	...overrides,
});

const reversal = (overrides: Partial<ProviderEvent> = {}): ProviderEvent => ({
	type: "payment.reversed",
	eventId: "evt_refund",
	subscriptionId: "sub_1",
	...overrides,
});

const statusWrites = (id: string) =>
	mockUpdatePurchase.mock.calls
		.map(([input]) => input as { id: string; status?: string })
		.filter((input) => input.id === id && input.status !== undefined)
		.map((input) => input.status);

beforeEach(() => {
	vi.clearAllMocks();
	mockGetPurchasesByOrganizationId.mockResolvedValue([]);
	mockGetActiveSubscriptionsForOwner.mockResolvedValue([]);
	mockGetOneTimePurchaseByPaymentRef.mockResolvedValue(null);
	provider.current = {
		id: "stripe",
		createCheckoutLink: vi.fn(),
		createCustomerPortalLink: vi.fn(),
		createCustomer: vi.fn(),
		cancelSubscription: vi.fn().mockResolvedValue(undefined),
		getSubscriptionStatus: vi.fn().mockResolvedValue("ACTIVE"),
		parseWebhook: vi.fn(),
	};
});

describe("payment.reversed on a subscription (full refund, dispute)", () => {
	it("cancels it at the provider now, closes the row and revokes the unused credits", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
			subscriptionRow(),
		);

		await processWebhookEvents("stripe", [reversal()]);

		expect(provider.current?.cancelSubscription).toHaveBeenCalledWith("sub_1", {
			mode: "immediate",
		});
		expect(statusWrites("purchase_sub")).toEqual(["CANCELED"]);
		expect(mockRevokeRecurringCredits).toHaveBeenCalledWith({
			organizationId: ORG,
			reason: "payment_reversed",
		});
		expect(mockDispatchEvent).toHaveBeenCalledWith(
			expect.objectContaining({ event: "subscription.canceled" }),
		);
	});

	it("still closes the row when the provider already ended it", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
			subscriptionRow(),
		);
		vi.mocked(
			provider.current?.cancelSubscription ?? vi.fn(),
		).mockRejectedValue(new Error("already canceled"));
		vi.mocked(
			provider.current?.getSubscriptionStatus ?? vi.fn(),
		).mockResolvedValue("CANCELED");

		await processWebhookEvents("stripe", [reversal()]);

		expect(statusWrites("purchase_sub")).toEqual(["CANCELED"]);
		expect(mockRevokeRecurringCredits).toHaveBeenCalled();
	});

	it("fails the delivery (provider retries) while the subscription still bills", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
			subscriptionRow(),
		);
		vi.mocked(
			provider.current?.cancelSubscription ?? vi.fn(),
		).mockRejectedValue(new Error("provider down"));

		await expect(
			processWebhookEvents("stripe", [reversal()]),
		).rejects.toThrow();
		expect(statusWrites("purchase_sub")).toEqual([]);
		expect(mockRevokeRecurringCredits).not.toHaveBeenCalled();
	});

	it("keeps the credits while another subscription of the owner grants access", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
			subscriptionRow(),
		);
		mockGetActiveSubscriptionsForOwner.mockResolvedValue([
			subscriptionRow({ id: "purchase_other", subscriptionId: "sub_other" }),
		]);

		await processWebhookEvents("stripe", [reversal()]);

		expect(statusWrites("purchase_sub")).toEqual(["CANCELED"]);
		expect(mockRevokeRecurringCredits).not.toHaveBeenCalled();
	});

	it("a redelivery on the closed row does not cancel again", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
			subscriptionRow({ status: "CANCELED" }),
		);

		await processWebhookEvents("stripe", [reversal()]);

		expect(provider.current?.cancelSubscription).not.toHaveBeenCalled();
		expect(statusWrites("purchase_sub")).toEqual([]);
	});

	it("ignores a reversal of a subscription it does not know", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);

		await processWebhookEvents("stripe", [reversal()]);

		expect(provider.current?.cancelSubscription).not.toHaveBeenCalled();
		expect(mockUpdatePurchase).not.toHaveBeenCalled();
	});
});

describe("payment.reversed on a one-time purchase", () => {
	const oneTimeRow = {
		id: "purchase_topup",
		type: "ONE_TIME",
		provider: "stripe",
		status: "ACTIVE",
		userId: "user_1",
		organizationId: null,
		metadata: { user_id: "user_1", fuutu_payment_ref: "pi_1" },
	};

	it("closes the purchase and revokes the unused top-up credits", async () => {
		mockGetOneTimePurchaseByPaymentRef.mockResolvedValue(oneTimeRow);

		await processWebhookEvents("stripe", [
			reversal({ subscriptionId: undefined, paymentRef: "pi_1" }),
		]);

		expect(mockGetOneTimePurchaseByPaymentRef).toHaveBeenCalledWith(
			"stripe",
			"pi_1",
		);
		expect(statusWrites("purchase_topup")).toEqual(["CANCELED"]);
		expect(mockRevokeTopUpCredits).toHaveBeenCalledWith({
			purchaseId: "purchase_topup",
			reason: "payment_reversed",
		});
	});

	it("ignores an unknown payment reference", async () => {
		await processWebhookEvents("stripe", [
			reversal({ subscriptionId: undefined, paymentRef: "pi_unknown" }),
		]);

		expect(mockUpdatePurchase).not.toHaveBeenCalled();
		expect(mockRevokeTopUpCredits).not.toHaveBeenCalled();
	});

	it("stores the payment reference on the purchase it creates", async () => {
		mockCreatePurchase.mockResolvedValue({ id: "purchase_new" });
		await processWebhookEvents("stripe", [
			{
				type: "checkout.completed",
				eventId: "evt_checkout",
				productId: "price_topup",
				paymentRef: "pi_1",
				metadata: { user_id: "user_1" },
			},
		]);

		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "ONE_TIME",
				metadata: { user_id: "user_1", fuutu_payment_ref: "pi_1" },
			}),
		);
	});
});

describe("a subscription that ends", () => {
	it.each(["ACTIVE", "TRIALING", "SCHEDULED_CANCEL", "PAST_DUE"])(
		"takes its unused recurring credits with it (%s → CANCELED)",
		async (status) => {
			mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
				subscriptionRow({
					status,
					currentPeriodEnd: new Date(Date.now() - DAY),
				}),
			);

			await processWebhookEvents("stripe", [
				{
					type: "subscription.canceled",
					subscriptionId: "sub_1",
					status: "CANCELED",
				},
			]);

			expect(statusWrites("purchase_sub")).toEqual(["CANCELED"]);
			expect(mockRevokeRecurringCredits).toHaveBeenCalledWith({
				organizationId: ORG,
				reason: "subscription_ended",
			});
		},
	);

	it("keeps them on a cancel scheduled for the period end", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
			subscriptionRow(),
		);

		await processWebhookEvents("stripe", [
			{
				type: "subscription.scheduled_cancel",
				subscriptionId: "sub_1",
				status: "SCHEDULED_CANCEL",
			},
		]);

		expect(mockRevokeRecurringCredits).not.toHaveBeenCalled();
	});

	it("keeps them while another subscription of the owner grants access", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
			subscriptionRow({ status: "TRIALING" }),
		);
		mockGetActiveSubscriptionsForOwner.mockResolvedValue([
			subscriptionRow({ id: "purchase_new", subscriptionId: "sub_new" }),
		]);

		await processWebhookEvents("stripe", [
			{
				type: "subscription.expired",
				subscriptionId: "sub_1",
				status: "EXPIRED",
			},
		]);

		expect(mockRevokeRecurringCredits).not.toHaveBeenCalled();
	});

	it("does not revoke again when an already ended row gets another end event", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(
			subscriptionRow({ status: "CANCELED" }),
		);

		await processWebhookEvents("stripe", [
			{
				type: "subscription.expired",
				subscriptionId: "sub_1",
				status: "EXPIRED",
			},
		]);

		expect(mockRevokeRecurringCredits).not.toHaveBeenCalled();
	});
});
