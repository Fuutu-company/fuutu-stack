import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @fuutu/db — we're testing the sync logic, not DB writes
const mockCreatePurchase = vi.fn();
const mockUpdatePurchase = vi.fn();
const mockGetPurchaseByProviderSubscriptionId = vi.fn();
const mockGetPurchaseByCheckoutEventId = vi.fn();
const mockGetPurchasesByOrganizationId = vi.fn();
const mockGetPurchasesByUserId = vi.fn();
const mockGetCreditBalance = vi.fn(
	async (_opts: {
		userId?: string;
		organizationId?: string;
		meterKey: string;
	}): Promise<{ recurringGranted: number; recurringPeriodEnd: Date } | null> =>
		null,
);

vi.mock("@fuutu/db", () => ({
	createPurchase: mockCreatePurchase,
	updatePurchase: mockUpdatePurchase,
	getPurchaseByProviderSubscriptionId: mockGetPurchaseByProviderSubscriptionId,
	getCreditBalance: mockGetCreditBalance,
	getPurchaseByCheckoutEventId: mockGetPurchaseByCheckoutEventId,
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
	getPurchasesByUserId: mockGetPurchasesByUserId,
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
	setPaymentsCustomerId: vi.fn(),
	setOrganizationPaymentsCustomerId: vi.fn(),
}));

// Mock @fuutu/credits — sync delegates credit mutations to its public API
const mockGrantRecurringCredits = vi.fn();
const mockGrantTopUpCredits = vi.fn();
const mockResetRecurringCredits = vi.fn();

vi.mock("@fuutu/credits", () => ({
	grantRecurringCredits: mockGrantRecurringCredits,
	grantTopUpCredits: mockGrantTopUpCredits,
	resetRecurringCredits: mockResetRecurringCredits,
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		PAYMENTS_PROVIDER: "polar",
		PAYMENTS_PRO_PRICE_ID: "test-pro-price",
		PAYMENTS_PRO_YEARLY_PRICE_ID: "test-pro-yearly",
		CREDITS_AI_TOKENS_100K_PRICE_ID: "test-100k",
		CREDITS_AI_TOKENS_500K_PRICE_ID: "test-500k",
		CREDITS_API_CALLS_50K_PRICE_ID: "test-50k",
		NODE_ENV: "test",
	},
}));

const { processWebhookEvents } = await import("../sync");

import type { ProviderEvent } from "../types";

const PROVIDER_ID = "test-provider";

function makeSubscriptionEvent(
	overrides: Partial<ProviderEvent> = {},
): ProviderEvent {
	return {
		type: "subscription.activated",
		subscriptionId: "sub_123",
		customerId: "cust_123",
		productId: "prod_123",
		status: "ACTIVE",
		metadata: { user_id: "user_123", organization_id: "org_123" },
		...overrides,
	};
}

describe("processWebhookEvents", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetCreditBalance.mockReset().mockResolvedValue(null);
	});

	it("creates a new purchase on subscription.activated", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);
		mockGetPurchasesByOrganizationId.mockResolvedValue([]);
		mockCreatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [makeSubscriptionEvent()]);

		// Owner XOR: when both ids arrive in metadata, the organization owns
		// the billing relationship (user_id stays in metadata only).
		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "SUBSCRIPTION",
				status: "ACTIVE",
				provider: PROVIDER_ID,
				subscriptionId: "sub_123",
				productId: "prod_123",
				userId: null,
				organizationId: "org_123",
			}),
		);
	});

	it("updates an existing purchase on subscription.updated", async () => {
		const existing = { id: "purchase_1", status: "ACTIVE" };
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(existing);
		mockUpdatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({ type: "subscription.updated", status: "ACTIVE" }),
		]);

		expect(mockUpdatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "purchase_1",
				status: "ACTIVE",
			}),
		);
		expect(mockCreatePurchase).not.toHaveBeenCalled();
	});

	it("does not overwrite SCHEDULED_CANCEL with ACTIVE on renewal", async () => {
		const existing = { id: "purchase_1", status: "SCHEDULED_CANCEL" };
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(existing);
		mockUpdatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({ type: "subscription.renewed", status: "ACTIVE" }),
		]);

		// Should NOT set status to ACTIVE — keeps SCHEDULED_CANCEL
		expect(mockUpdatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "purchase_1",
			}),
		);
		const call = mockUpdatePurchase.mock.calls[0]?.[0];
		expect(call.status).toBeUndefined();
	});

	it("sets SCHEDULED_CANCEL when subscription.canceled has future period end", async () => {
		const existing = { id: "purchase_1", status: "ACTIVE" };
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(existing);
		mockUpdatePurchase.mockClear();

		const future = new Date();
		future.setDate(future.getDate() + 10);

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				type: "subscription.canceled",
				status: "CANCELED",
				currentPeriodEnd: future,
			}),
		]);

		expect(mockUpdatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "purchase_1",
				status: "SCHEDULED_CANCEL",
			}),
		);
	});

	it("sets CANCELED when subscription.canceled has past period end", async () => {
		const existing = { id: "purchase_1", status: "ACTIVE" };
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(existing);
		mockUpdatePurchase.mockClear();

		const past = new Date();
		past.setDate(past.getDate() - 10);

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				type: "subscription.canceled",
				status: "CANCELED",
				currentPeriodEnd: past,
			}),
		]);

		expect(mockUpdatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "purchase_1",
				status: "CANCELED",
			}),
		);
	});

	it("creates one-time purchase on checkout.completed without subscription", async () => {
		mockCreatePurchase.mockResolvedValue({ id: "purchase_1" });

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				customerId: "cust_123",
				productId: "prod_456",
				metadata: { user_id: "user_123" },
			},
		]);

		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "ONE_TIME",
				status: "ACTIVE",
				provider: PROVIDER_ID,
				productId: "prod_456",
				userId: "user_123",
			}),
		);
	});

	it("creates subscription purchase on checkout.completed with subscriptionId", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);
		mockGetPurchasesByUserId.mockResolvedValue([]);
		mockCreatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				subscriptionId: "sub_123",
				productId: "prod_456",
				metadata: { user_id: "user_123" },
			},
		]);

		// checkout.completed with subscriptionId is treated as subscription activation
		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "SUBSCRIPTION",
				subscriptionId: "sub_123",
			}),
		);
	});

	it("cancels old subscriptions when a new one activates for the same org", async () => {
		const oldPurchase = {
			id: "old_purchase",
			type: "SUBSCRIPTION",
			subscriptionId: "sub_old",
			status: "ACTIVE",
		};
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);
		mockGetPurchasesByOrganizationId.mockResolvedValue([oldPurchase]);
		mockUpdatePurchase.mockClear();
		mockCreatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				subscriptionId: "sub_new",
				metadata: { organization_id: "org_123" },
			}),
		]);

		// Old subscription should be canceled
		expect(mockUpdatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "old_purchase",
				status: "CANCELED",
			}),
		);
		// New purchase should be created
		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				subscriptionId: "sub_new",
			}),
		);
	});

	it("skips events without subscriptionId for subscription types", async () => {
		mockCreatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "subscription.activated",
				productId: "prod_123",
				metadata: {},
			},
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
	});

	it("is idempotent — processing the same event twice doesn't create duplicates", async () => {
		const existing = { id: "purchase_1", status: "ACTIVE" };
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(existing);
		mockCreatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({ type: "subscription.updated" }),
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
		expect(mockUpdatePurchase).toHaveBeenCalledOnce();
	});

	it("rethrows when an event fails so the webhook handler returns 5xx", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "ACTIVE",
		});
		mockUpdatePurchase.mockRejectedValueOnce(new Error("db down"));

		await expect(
			processWebhookEvents(PROVIDER_ID, [
				makeSubscriptionEvent({ type: "subscription.updated" }),
			]),
		).rejects.toThrow("1 webhook event(s) failed");
	});

	it("processes remaining events when one fails, then throws", async () => {
		mockGetPurchaseByProviderSubscriptionId
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "purchase_2", status: "ACTIVE" });
		mockGetPurchasesByUserId.mockResolvedValue([]);
		mockCreatePurchase.mockRejectedValueOnce(new Error("insert failed"));

		await expect(
			processWebhookEvents(PROVIDER_ID, [
				{
					type: "checkout.completed",
					subscriptionId: "sub_new",
					productId: "prod_456",
					metadata: { user_id: "user_1" },
				},
				makeSubscriptionEvent({
					type: "subscription.updated",
					subscriptionId: "sub_2",
				}),
			]),
		).rejects.toThrow("1 webhook event(s) failed");

		// The second event was still processed despite the first failing
		expect(mockUpdatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({ id: "purchase_2" }),
		);
	});

	it("dedupes one-time checkout.completed by provider event id", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue({ id: "purchase_dup" });

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				eventId: "evt_dup",
				productId: "prod_456",
				metadata: { user_id: "user_123" },
			},
		]);

		expect(mockGetPurchaseByCheckoutEventId).toHaveBeenCalledWith(
			PROVIDER_ID,
			"evt_dup",
		);
		expect(mockCreatePurchase).not.toHaveBeenCalled();
	});

	it("stores checkoutEventId in purchase metadata for dedup", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue(null);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_1" });

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				eventId: "evt_1",
				productId: "prod_456",
				metadata: { user_id: "user_123" },
			},
		]);

		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({ checkoutEventId: "evt_1" }),
			}),
		);
	});

	it("re-attempts the top-up grant on a deduplicated redelivery", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue({ id: "purchase_dup" });

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				eventId: "evt_dup",
				productId: "prod_topup",
				metadata: {
					user_id: "user_123",
					credit_topup: { meterKey: "ai_tokens", amount: 1000 },
				},
			},
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
		expect(mockGrantTopUpCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				purchaseId: "purchase_dup",
				meterKey: "ai_tokens",
				amount: 1000,
			}),
		);
	});

	it("grants plan credits via @fuutu/credits on subscription activation", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);
		mockGetPurchasesByOrganizationId.mockResolvedValue([]);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_1" });

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({ productId: "test-pro-price" }),
		]);

		// pro plan: ai_tokens=500k, api_calls=50k, documents="unlimited" (skipped)
		expect(mockGrantRecurringCredits).toHaveBeenCalledTimes(2);
		expect(mockGrantRecurringCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				meterKey: "ai_tokens",
				amount: 500_000,
				organizationId: "org_123",
				userId: undefined,
			}),
		);
		expect(mockGrantRecurringCredits).toHaveBeenCalledWith(
			expect.objectContaining({ meterKey: "api_calls", amount: 50_000 }),
		);
	});

	it("resets recurring credits via @fuutu/credits on renewal, applying plan grants", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "ACTIVE",
			userId: "user_123",
		});

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				type: "subscription.renewed",
				productId: "test-pro-price",
				currentPeriodEnd: new Date("2027-01-01"),
				metadata: { user_id: "user_123" },
			}),
		]);

		expect(mockResetRecurringCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user_123",
				newPeriodEnd: new Date("2027-01-01"),
				newGranted: { ai_tokens: 500_000, api_calls: 50_000 },
			}),
		);
	});

	it("re-attempts the credit grant on a redelivered subscription.activated", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "ACTIVE",
			userId: "user_123",
		});

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				productId: "test-pro-price",
				metadata: { user_id: "user_123" },
			}),
		]);

		// Grant ran against the existing purchase — a failed first delivery
		// (which propagates as 5xx) is recovered by the provider's retry.
		expect(mockGrantRecurringCredits).toHaveBeenCalledTimes(2);
	});

	it("skips already-granted meters on redelivery (no duplicate credit_event)", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "ACTIVE",
			userId: "user_123",
		});
		const periodEnd = new Date("2027-01-01");
		mockGetCreditBalance.mockImplementation(
			async ({ meterKey }: { meterKey: string }) =>
				meterKey === "ai_tokens"
					? {
							recurringGranted: 500_000,
							recurringPeriodEnd: periodEnd,
						}
					: null,
		);

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				productId: "test-pro-price",
				currentPeriodEnd: periodEnd,
				metadata: { user_id: "user_123" },
			}),
		]);

		// ai_tokens balance already matches the grant → skipped;
		// api_calls balance missing → granted.
		expect(mockGrantRecurringCredits).toHaveBeenCalledTimes(1);
		expect(mockGrantRecurringCredits).toHaveBeenCalledWith(
			expect.objectContaining({ meterKey: "api_calls", amount: 50_000 }),
		);
	});

	it("propagates a grant failure so the webhook handler returns 5xx", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);
		mockGetPurchasesByOrganizationId.mockResolvedValue([]);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_1" });
		mockGrantRecurringCredits.mockRejectedValue(new Error("db down"));

		await expect(
			processWebhookEvents(PROVIDER_ID, [
				makeSubscriptionEvent({ productId: "test-pro-price" }),
			]),
		).rejects.toThrow("1 webhook event(s) failed");
	});
});
