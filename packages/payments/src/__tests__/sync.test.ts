import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @fuutu/db — we're testing the sync logic, not DB writes
const mockCreatePurchase = vi.fn();
const mockUpdatePurchase = vi.fn();
const mockGetPurchaseByProviderSubscriptionId = vi.fn();
const mockGetPurchaseByCheckoutEventId = vi.fn();
const mockGetPurchasesByOrganizationId = vi.fn();
const mockGetPurchasesByUserId = vi.fn();
const mockUpsertInvoiceByProviderId = vi.fn();
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
	upsertInvoiceByProviderId: mockUpsertInvoiceByProviderId,
	// Real implementation — the sync layer relies on P2002 detection to
	// recover from find-then-create races on unique indexes.
	isUniqueViolation: (err: unknown) =>
		err instanceof Error && "code" in err && err.code === "P2002",
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

const mockLogWarn = vi.hoisted(() => vi.fn());
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: mockLogWarn,
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

	it("grants top-up credits to the stored purchase owner on a deduplicated redelivery", async () => {
		// A redelivery carrying divergent owner metadata must still grant to
		// the owner recorded on the purchase — not to event metadata.
		mockGetPurchaseByCheckoutEventId.mockResolvedValue({
			id: "purchase_dup",
			userId: null,
			organizationId: "org_stored",
		});

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				eventId: "evt_dup",
				productId: "prod_topup",
				metadata: {
					user_id: "forged_user",
					topup_id: "ai_tokens_100k",
				},
			},
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
		expect(mockGrantTopUpCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				purchaseId: "purchase_dup",
				userId: undefined,
				organizationId: "org_stored",
			}),
		);
	});

	it("grants top-up credits to the stored owner when redelivery metadata has none", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue({
			id: "purchase_dup",
			userId: "user_stored",
			organizationId: null,
		});

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				eventId: "evt_dup",
				productId: "prod_topup",
				metadata: { topup_id: "ai_tokens_100k" },
			},
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
		expect(mockGrantTopUpCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				purchaseId: "purchase_dup",
				userId: "user_stored",
				organizationId: undefined,
			}),
		);
	});

	it("grants top-up credits to the winning purchase when create loses a redelivery race", async () => {
		// A concurrent redelivery committed first — createPurchase throws
		// P2002. The grant must target the winning row (a prior attempt may
		// have inserted the purchase but failed the grant), not be skipped.
		mockGetPurchaseByCheckoutEventId
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({
				id: "purchase_winner",
				userId: null,
				organizationId: "org_winner",
			});
		const uniqueErr = Object.assign(new Error("unique"), { code: "P2002" });
		mockCreatePurchase.mockRejectedValueOnce(uniqueErr);

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				eventId: "evt_race",
				productId: "prod_topup",
				metadata: {
					user_id: "forged_user",
					topup_id: "ai_tokens_100k",
				},
			},
		]);

		expect(mockGrantTopUpCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				purchaseId: "purchase_winner",
				userId: undefined,
				organizationId: "org_winner",
			}),
		);
	});

	it("propagates a unique violation that cannot be attributed to a winning purchase", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue(null);
		const uniqueErr = Object.assign(new Error("unique"), { code: "P2002" });
		mockCreatePurchase.mockRejectedValueOnce(uniqueErr);

		// A P2002 on a different constraint is not a dedup race — it must
		// propagate so the provider retries instead of dropping the event.
		await expect(
			processWebhookEvents(PROVIDER_ID, [
				{
					type: "checkout.completed",
					eventId: "evt_orphan",
					productId: "prod_topup",
					metadata: {
						user_id: "user_1",
						topup_id: "ai_tokens_100k",
					},
				},
			]),
		).rejects.toThrow("1 webhook event(s) failed");

		expect(mockGrantTopUpCredits).not.toHaveBeenCalled();
	});

	it("propagates a unique violation when the event carries no eventId", async () => {
		const uniqueErr = Object.assign(new Error("unique"), { code: "P2002" });
		mockCreatePurchase.mockRejectedValueOnce(uniqueErr);

		// Without an eventId there is no dedup key to look up — the
		// violation is unattributable and must propagate.
		await expect(
			processWebhookEvents(PROVIDER_ID, [
				{
					type: "checkout.completed",
					productId: "prod_topup",
					metadata: {
						user_id: "user_1",
						topup_id: "ai_tokens_100k",
					},
				},
			]),
		).rejects.toThrow("1 webhook event(s) failed");

		expect(mockGetPurchaseByCheckoutEventId).not.toHaveBeenCalled();
		expect(mockGrantTopUpCredits).not.toHaveBeenCalled();
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
					topup_id: "ai_tokens_100k",
				},
			},
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
		expect(mockGrantTopUpCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				purchaseId: "purchase_dup",
				meterKey: "ai_tokens",
				amount: 100_000,
			}),
		);
	});

	it.each(["CANCELED", "EXPIRED"] as const)(
		"does not reactivate a %s subscription on a late renewal",
		async (status) => {
			mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
				id: "purchase_1",
				status,
			});
			mockUpdatePurchase.mockClear();

			await processWebhookEvents(PROVIDER_ID, [
				makeSubscriptionEvent({
					type: "subscription.renewed",
					status: "ACTIVE",
				}),
			]);

			const call = mockUpdatePurchase.mock.calls[0]?.[0];
			expect(call).toBeDefined();
			expect(call.status).toBeUndefined();
		},
	);

	it.each(["CANCELED", "EXPIRED"] as const)(
		"does not grant plan credits on a late renewal for a %s subscription",
		async (status) => {
			mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
				id: "purchase_1",
				status,
				userId: "user_123",
				metadata: { user_id: "user_123" },
			});

			await processWebhookEvents(PROVIDER_ID, [
				makeSubscriptionEvent({
					type: "subscription.renewed",
					productId: "test-pro-price",
					metadata: { user_id: "user_123" },
					currentPeriodEnd: new Date("2027-02-01"),
				}),
			]);

			expect(mockGrantRecurringCredits).not.toHaveBeenCalled();
			expect(mockResetRecurringCredits).not.toHaveBeenCalled();
		},
	);

	it.each(["CANCELED", "EXPIRED"] as const)(
		"does not reactivate a %s subscription on a late activation",
		async (status) => {
			mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
				id: "purchase_1",
				status,
			});
			mockUpdatePurchase.mockClear();

			await processWebhookEvents(PROVIDER_ID, [
				makeSubscriptionEvent({
					type: "subscription.activated",
					status: "ACTIVE",
				}),
			]);

			const call = mockUpdatePurchase.mock.calls[0]?.[0];
			expect(call).toBeDefined();
			expect(call.status).toBeUndefined();
		},
	);

	it.each(["PAST_DUE", "PAUSED"] as const)(
		"recovers a %s subscription on subscription.activated",
		async (status) => {
			mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
				id: "purchase_1",
				status,
				userId: "user_123",
			});
			mockUpdatePurchase.mockClear();

			await processWebhookEvents(PROVIDER_ID, [
				makeSubscriptionEvent({
					type: "subscription.activated",
					status: "ACTIVE",
					productId: "test-pro-price",
					metadata: { user_id: "user_123" },
				}),
			]);

			expect(mockUpdatePurchase).toHaveBeenCalledWith(
				expect.objectContaining({ id: "purchase_1", status: "ACTIVE" }),
			);
			// Mid-period recovery must not re-grant plan credits — the stored
			// protected status still gates the grant re-attempt.
			expect(mockGrantRecurringCredits).not.toHaveBeenCalled();
		},
	);

	it.each(["PAST_DUE", "PAUSED"] as const)(
		"recovers a %s subscription on subscription.renewed and resets credits",
		async (status) => {
			mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
				id: "purchase_1",
				status,
				userId: "user_123",
			});
			mockUpdatePurchase.mockClear();

			await processWebhookEvents(PROVIDER_ID, [
				makeSubscriptionEvent({
					type: "subscription.renewed",
					status: "ACTIVE",
					productId: "test-pro-price",
					currentPeriodEnd: new Date("2027-02-01"),
					metadata: { user_id: "user_123" },
				}),
			]);

			expect(mockUpdatePurchase).toHaveBeenCalledWith(
				expect.objectContaining({ id: "purchase_1", status: "ACTIVE" }),
			);
			// Period-boundary recovery: a renewed-after-dunning carries a new
			// periodEnd and runs the normal renewal reset.
			expect(mockResetRecurringCredits).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: "user_123",
					newPeriodEnd: new Date("2027-02-01"),
				}),
			);
			expect(mockGrantRecurringCredits).not.toHaveBeenCalled();
		},
	);

	it("keeps SCHEDULED_CANCEL on subscription.activated", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "SCHEDULED_CANCEL",
		});
		mockUpdatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				type: "subscription.activated",
				status: "ACTIVE",
			}),
		]);

		const call = mockUpdatePurchase.mock.calls[0]?.[0];
		expect(call).toBeDefined();
		expect(call.status).toBeUndefined();
	});

	it("keeps PAST_DUE on checkout.completed (stale creation signal)", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "PAST_DUE",
		});
		mockUpdatePurchase.mockClear();

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				type: "checkout.completed",
				status: "ACTIVE",
			}),
		]);

		const call = mockUpdatePurchase.mock.calls[0]?.[0];
		expect(call).toBeDefined();
		expect(call.status).toBeUndefined();
	});

	it("routes one_time.purchased to the one-time purchase handler", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue(null);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_ot" });

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "one_time.purchased",
				eventId: "evt_ot",
				customerId: "cust_123",
				productId: "prod_ot",
				metadata: { user_id: "user_123" },
			},
		]);

		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "ONE_TIME",
				status: "ACTIVE",
				provider: PROVIDER_ID,
				productId: "prod_ot",
				userId: "user_123",
			}),
		);
	});

	it("warns via the one-time handler for a productId-less one_time.purchased", async () => {
		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "one_time.purchased",
				eventId: "evt_noprod",
				metadata: { user_id: "user_123" },
			},
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
		expect(mockGetPurchaseByProviderSubscriptionId).not.toHaveBeenCalled();
		expect(mockLogWarn).toHaveBeenCalledWith(
			"one-time purchase event without productId, skipping",
			expect.objectContaining({ type: "one_time.purchased" }),
		);
	});

	it("warns via the one-time handler for checkout.completed without subscriptionId or productId", async () => {
		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				metadata: { user_id: "user_123" },
			},
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
		expect(mockGetPurchaseByProviderSubscriptionId).not.toHaveBeenCalled();
		expect(mockLogWarn).toHaveBeenCalledWith(
			"one-time purchase event without productId, skipping",
			expect.objectContaining({ type: "checkout.completed" }),
		);
		expect(mockLogWarn).not.toHaveBeenCalledWith(
			"subscription event without subscriptionId, skipping",
			expect.anything(),
		);
	});

	it("does not treat one_time.purchased as a subscription activation", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue(null);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_ot" });

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "one_time.purchased",
				subscriptionId: "sub_should_not_matter",
				productId: "prod_ot",
				metadata: { user_id: "user_123" },
			},
		]);

		// Even with a subscriptionId on the payload, the event type is
		// authoritative — the purchase is ONE_TIME, never SUBSCRIPTION.
		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({ type: "ONE_TIME" }),
		);
	});

	it("grants top-up credits from the CREDIT_TOPUPS catalog, not echoed metadata", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue(null);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_topup" });

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				eventId: "evt_topup",
				productId: "prod_topup",
				metadata: {
					user_id: "user_123",
					topup_id: "ai_tokens_500k",
					// Forged echoes — the catalog values must win.
					meter_key: "api_calls",
					amount: 1,
				},
			},
		]);

		expect(mockGrantTopUpCredits).toHaveBeenCalledWith(
			expect.objectContaining({
				purchaseId: "purchase_topup",
				meterKey: "ai_tokens",
				amount: 500_000,
				userId: "user_123",
			}),
		);
	});

	it("skips the credit grant when topup_id is not in CREDIT_TOPUPS", async () => {
		mockGetPurchaseByCheckoutEventId.mockResolvedValue(null);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_bad" });

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "checkout.completed",
				eventId: "evt_bad",
				productId: "prod_x",
				metadata: {
					user_id: "user_123",
					topup_id: "not_a_real_topup",
					meter_key: "ai_tokens",
					amount: 999_999_999,
				},
			},
		]);

		expect(mockGrantTopUpCredits).not.toHaveBeenCalled();
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

	it("skips an invoice.paid renewal that arrives before subscription.created, then converges", async () => {
		// Stripe does not guarantee webhook ordering — invoice.paid (mapped to
		// subscription.renewed) may be delivered before
		// customer.subscription.created. The early event has no purchase row
		// and no productId/owner metadata, so it is skipped rather than
		// creating a purchase without a product or owner. The subscription
		// event then converges state normally.
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue(null);

		await processWebhookEvents(PROVIDER_ID, [
			{
				type: "subscription.renewed",
				subscriptionId: "sub_123",
				customerId: "cust_123",
				status: "ACTIVE",
				currentPeriodEnd: new Date("2027-01-01"),
			},
		]);

		expect(mockCreatePurchase).not.toHaveBeenCalled();
		expect(mockGrantRecurringCredits).not.toHaveBeenCalled();

		// The real subscription.activated converges the state.
		mockGetPurchasesByOrganizationId.mockResolvedValue([]);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_1" });
		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({ productId: "test-pro-price" }),
		]);
		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({ subscriptionId: "sub_123" }),
		);
		expect(mockGrantRecurringCredits).toHaveBeenCalled();
	});

	it("orders subscription_grant before period_reset when invoice.paid follows creation", async () => {
		// Stripe delivers customer.subscription.created and the first
		// invoice.paid nearly simultaneously. The grant must land before the
		// renewal reset — a period_reset can never precede its
		// subscription_grant in the ledger. (A duplicate reset for the same
		// period is additionally CAS-guarded inside resetRecurringCreditsTx.)
		mockGetPurchaseByProviderSubscriptionId
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({
				id: "purchase_1",
				status: "ACTIVE",
				userId: "user_123",
				metadata: { user_id: "user_123" },
			});
		mockGetPurchasesByUserId.mockResolvedValue([]);
		mockCreatePurchase.mockResolvedValue({ id: "purchase_1" });

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				productId: "test-pro-price",
				metadata: { user_id: "user_123" },
			}),
			makeSubscriptionEvent({
				type: "subscription.renewed",
				productId: "test-pro-price",
				metadata: { user_id: "user_123" },
				currentPeriodEnd: new Date("2027-02-01"),
			}),
		]);

		expect(mockGrantRecurringCredits).toHaveBeenCalled();
		expect(mockResetRecurringCredits).toHaveBeenCalledTimes(1);
		const grantOrder =
			mockGrantRecurringCredits.mock.invocationCallOrder[0] ?? 0;
		const resetOrder =
			mockResetRecurringCredits.mock.invocationCallOrder[0] ?? 0;
		expect(grantOrder).toBeGreaterThan(0);
		expect(grantOrder).toBeLessThan(resetOrder);
	});

	it("records a paid invoice row when a renewal event carries invoice data", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "ACTIVE",
			userId: "user_123",
		});

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				type: "subscription.renewed",
				currentPeriodEnd: new Date("2027-02-01"),
				metadata: { user_id: "user_123" },
				invoice: {
					id: "in_123",
					url: "https://pay.stripe.com/invoice/in_123",
					pdfUrl: "https://pay.stripe.com/invoice/in_123.pdf",
					amount: "19.00",
					currency: "USD",
					status: "paid",
					issuedAt: new Date("2027-01-01"),
					paidAt: new Date("2027-01-01"),
				},
			}),
		]);

		expect(mockUpsertInvoiceByProviderId).toHaveBeenCalledWith(
			expect.objectContaining({
				providerInvoiceId: `${PROVIDER_ID}:in_123`,
				userId: "user_123",
				status: "paid",
				amount: "19.00",
			}),
		);
	});

	it("attributes an org-owned invoice to the checkout user_id from purchase metadata", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "ACTIVE",
			userId: null,
			organizationId: "org_123",
			metadata: { organization_id: "org_123", user_id: "user_123" },
		});

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({
				type: "subscription.renewed",
				metadata: { organization_id: "org_123" },
				invoice: {
					id: "in_org",
					amount: "19.00",
					status: "paid",
				},
			}),
		]);

		expect(mockUpsertInvoiceByProviderId).toHaveBeenCalledWith(
			expect.objectContaining({
				organizationId: "org_123",
				userId: "user_123",
			}),
		);
	});

	it("does not write an invoice row for events without invoice data", async () => {
		mockGetPurchaseByProviderSubscriptionId.mockResolvedValue({
			id: "purchase_1",
			status: "ACTIVE",
			userId: "user_123",
		});

		await processWebhookEvents(PROVIDER_ID, [
			makeSubscriptionEvent({ type: "subscription.updated" }),
		]);

		expect(mockUpsertInvoiceByProviderId).not.toHaveBeenCalled();
	});

	it("treats a redelivered identical top-up event as a no-op (single purchase, idempotent grant)", async () => {
		mockGetPurchaseByCheckoutEventId
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce({ id: "purchase_topup", userId: "user_123" });
		mockCreatePurchase.mockResolvedValue({ id: "purchase_topup" });

		const topupEvent: ProviderEvent = {
			type: "checkout.completed",
			eventId: "evt_dup",
			productId: "prod_topup",
			metadata: { user_id: "user_123", topup_id: "ai_tokens_100k" },
		};
		await processWebhookEvents(PROVIDER_ID, [topupEvent]);
		await processWebhookEvents(PROVIDER_ID, [topupEvent]);

		// Only one Purchase row — the dedup lookup short-circuits the second.
		expect(mockCreatePurchase).toHaveBeenCalledTimes(1);
		// The grant is re-attempted against the SAME purchaseId — a no-op at
		// the DB level via the credit_package(purchaseId) unique index.
		expect(mockGrantTopUpCredits).toHaveBeenCalledTimes(2);
		expect(mockGrantTopUpCredits).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ purchaseId: "purchase_topup" }),
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
