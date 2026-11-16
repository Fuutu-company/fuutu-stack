import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider, ProviderEvent } from "../types";

// An unpaid subscription (Stripe `incomplete` while SEPA/ACH processes)
// must neither cancel the plan it replaces nor grant credits — both
// happen once it turns ACTIVE/TRIALING.

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

vi.mock("@fuutu/db", () => ({
	createPurchase: mockCreatePurchase,
	updatePurchase: mockUpdatePurchase,
	getPurchaseByProviderSubscriptionId: mockGetPurchaseByProviderSubscriptionId,
	getPurchaseByCheckoutEventId: vi.fn(),
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
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

const mockGrantRecurringCredits = vi.fn();
vi.mock("@fuutu/credits", () => ({
	grantRecurringCredits: mockGrantRecurringCredits,
	grantTopUpCredits: vi.fn(),
	resetRecurringCredits: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/webhooks", () => ({ dispatchEvent: vi.fn() }));

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

const oldPlan = {
	id: "purchase_old",
	type: "SUBSCRIPTION",
	provider: "stripe",
	subscriptionId: "sub_old",
	productId: "price_pro_yearly",
	priceId: "price_pro_yearly",
	organizationId: ORG,
	userId: null,
	status: "ACTIVE",
	metadata: { organization_id: ORG },
};

const incompleteRow = {
	id: "purchase_new",
	type: "SUBSCRIPTION",
	provider: "stripe",
	subscriptionId: "sub_new",
	productId: "price_pro",
	priceId: "price_pro",
	organizationId: ORG,
	userId: null,
	status: "INCOMPLETE",
	currentPeriodEnd: null,
	metadata: { organization_id: ORG },
};

const event = (overrides: Partial<ProviderEvent>): ProviderEvent => ({
	type: "subscription.activated",
	subscriptionId: "sub_new",
	productId: "price_pro",
	metadata: { organization_id: ORG },
	...overrides,
});

const statusWrites = (id: string) =>
	mockUpdatePurchase.mock.calls
		.map(([input]) => input as { id: string; status?: string })
		.filter((input) => input.id === id && input.status !== undefined)
		.map((input) => input.status);

beforeEach(() => {
	vi.clearAllMocks();
	mockGetPurchasesByOrganizationId.mockResolvedValue([oldPlan]);
	provider.current = {
		id: "stripe",
		createCheckoutLink: vi.fn(),
		createCustomerPortalLink: vi.fn(),
		createCustomer: vi.fn(),
		cancelSubscription: vi.fn().mockResolvedValue(undefined),
		parseWebhook: vi.fn(),
	};
});

describe("a new subscription that is not paid yet", () => {
	it("is stored INCOMPLETE without canceling the plan it replaces", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);

		await processWebhookEvents("stripe", [event({ status: "INCOMPLETE" })]);

		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				subscriptionId: "sub_new",
				status: "INCOMPLETE",
			}),
		);
		expect(provider.current?.cancelSubscription).not.toHaveBeenCalled();
		expect(statusWrites("purchase_old")).toEqual([]);
	});

	it("grants no credits", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);

		await processWebhookEvents("stripe", [event({ status: "INCOMPLETE" })]);

		expect(mockGrantRecurringCredits).not.toHaveBeenCalled();
	});

	it("a redelivered INCOMPLETE activation still grants nothing", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(incompleteRow);

		await processWebhookEvents("stripe", [event({ status: "INCOMPLETE" })]);

		expect(mockGrantRecurringCredits).not.toHaveBeenCalled();
		expect(provider.current?.cancelSubscription).not.toHaveBeenCalled();
	});
});

describe("an INCOMPLETE subscription whose payment clears", () => {
	it("supersedes the old plan and grants credits on subscription.updated → ACTIVE", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(incompleteRow);

		await processWebhookEvents("stripe", [
			event({ type: "subscription.updated", status: "ACTIVE" }),
		]);

		expect(statusWrites("purchase_new")).toEqual(["ACTIVE"]);
		expect(provider.current?.cancelSubscription).toHaveBeenCalledWith(
			"sub_old",
			{ mode: "immediate" },
		);
		expect(statusWrites("purchase_old")).toEqual(["CANCELED"]);
		expect(mockGrantRecurringCredits).toHaveBeenCalledWith(
			expect.objectContaining({ organizationId: ORG, meterKey: "ai_tokens" }),
		);
	});

	it("supersedes on the first paid invoice (no productId on the event)", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(incompleteRow);

		await processWebhookEvents("stripe", [
			event({
				type: "subscription.renewed",
				status: "ACTIVE",
				productId: undefined,
				currentPeriodEnd: new Date(Date.now() + 86_400_000),
			}),
		]);

		expect(provider.current?.cancelSubscription).toHaveBeenCalledWith(
			"sub_old",
			{ mode: "immediate" },
		);
		expect(mockGrantRecurringCredits).toHaveBeenCalled();
	});

	it("does not supersede again once the row is already ACTIVE", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			...incompleteRow,
			status: "ACTIVE",
		});

		await processWebhookEvents("stripe", [
			event({ type: "subscription.updated", status: "ACTIVE" }),
		]);

		expect(provider.current?.cancelSubscription).not.toHaveBeenCalled();
	});
});
