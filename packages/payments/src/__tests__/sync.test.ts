import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @fuutu/db — we're testing the sync logic, not DB writes
const mockCreatePurchase = vi.fn();
const mockUpdatePurchase = vi.fn();
const mockGetPurchaseByProviderSubscriptionId = vi.fn();
const mockGetPurchasesByOrganizationId = vi.fn();
const mockGetPurchasesByUserId = vi.fn();

vi.mock("@fuutu/db", () => ({
	createPurchase: mockCreatePurchase,
	updatePurchase: mockUpdatePurchase,
	getPurchaseByProviderSubscriptionId: mockGetPurchaseByProviderSubscriptionId,
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
	getPurchasesByUserId: mockGetPurchasesByUserId,
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
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
	});

	it("creates a new purchase on subscription.activated", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);
		mockGetPurchasesByOrganizationId.mockResolvedValue([]);
		mockCreatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [makeSubscriptionEvent()]);

		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "SUBSCRIPTION",
				status: "ACTIVE",
				provider: PROVIDER_ID,
				subscriptionId: "sub_123",
				productId: "prod_123",
				userId: "user_123",
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
		mockCreatePurchase.mockClear();

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
});
