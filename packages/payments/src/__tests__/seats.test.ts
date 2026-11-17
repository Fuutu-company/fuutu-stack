import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockProviderShape {
	id: string;
	ownsSeatSync?: boolean;
	setSubscriptionSeats?: (input: {
		subscriptionId: string;
		seats: number;
	}) => Promise<void>;
	cancelSubscription?: (subscriptionId: string) => Promise<void>;
	getSubscriptionStatus?: (subscriptionId: string) => Promise<string>;
}

const mocks = vi.hoisted((): { provider: MockProviderShape } => ({
	provider: {
		id: "test-provider",
		ownsSeatSync: false,
		setSubscriptionSeats: vi.fn(),
		cancelSubscription: vi.fn(),
	},
}));

const mockGetActiveSubscriptionForOrganization = vi.fn();
const mockGetPurchasesByOrganizationId = vi.fn();
const mockGetOrganizationSeatSubscriptions = vi.fn();

vi.mock("@fuutu/db", () => ({
	getOrganizationSeatSubscriptions: mockGetOrganizationSeatSubscriptions,
	getActiveSubscriptionForOrganization:
		mockGetActiveSubscriptionForOrganization,
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
	getActiveSubscriptionsForOwner: vi.fn().mockResolvedValue([]),
}));

const mockWarn = vi.fn();
const mockError = vi.hoisted(() => vi.fn());
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: mockWarn,
		error: mockError,
		debug: vi.fn(),
	}),
}));

// Price → plan map, catalog-agnostic: "price-pro" is the first seat-based
// plan in PLANS, "price-flat" the first paid plan without seat pricing.
vi.mock("../config.server", async () => {
	const { PLANS } = await import("../config");
	const entries = Object.entries(PLANS) as [
		string,
		{ seatBased?: boolean; billingType: string },
	][];
	const seat = entries.find(([, p]) => p.seatBased)?.[0];
	const flat = entries.find(
		([, p]) => p.billingType !== "free" && !p.seatBased,
	)?.[0];
	return {
		getPlanIdForProductId: (productId: string) =>
			({ "price-pro": seat, "price-flat": flat })[productId],
	};
});

const mockSetSubscriptionSeats = vi.fn();
const mockCancelSubscription = vi.fn();

const mockOtherCancel = vi.fn();

vi.mock("../resolve", () => ({
	resolvePaymentProvider: () => mocks.provider,
	resolvePaymentProviderById: (id: string) =>
		id === mocks.provider.id
			? mocks.provider
			: id === "other-provider"
				? { id, cancelSubscription: mockOtherCancel }
				: null,
}));

// Pass-through spy: lets a test stand in for the plan-subscription lookup
// (add-on filtering is covered in sync-supersede.test.ts).
const mockGetPlanSubscription = vi.hoisted(() => vi.fn());
vi.mock("../billing-policy", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../billing-policy")>();
	mockGetPlanSubscription.mockImplementation(actual.getPlanSubscription);
	return { ...actual, getPlanSubscription: mockGetPlanSubscription };
});

const {
	updateSeatsInOrganizationSubscription,
	cancelAllSubscriptionsForOrganization,
	cancelAllSubscriptionsForOrganizationOrThrow,
	reconcileOrganizationSeats,
} = await import("../seats");
const { paymentsConfig } = await import("../config");

describe("updateSeatsInOrganizationSubscription", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.provider = {
			id: "test-provider",
			ownsSeatSync: false,
			setSubscriptionSeats: mockSetSubscriptionSeats,
			cancelSubscription: mockCancelSubscription,
		};
		mockGetActiveSubscriptionForOrganization.mockResolvedValue({
			id: "purchase_1",
			provider: "test-provider",
			subscriptionId: "sub_123",
			productId: "price-pro",
			priceId: "price-pro",
			status: "ACTIVE",
		});
	});

	it("calls setSubscriptionSeats with the active subscription's id", async () => {
		await updateSeatsInOrganizationSubscription("org_1", 5);

		expect(mockSetSubscriptionSeats).toHaveBeenCalledWith({
			subscriptionId: "sub_123",
			seats: 5,
		});
	});

	it("syncs seats on the plan subscription, never on a newer add-on", async () => {
		// The newest active row is an add-on (e.g. a seat pack) — seat sync
		// must target the base plan's subscription.
		mockGetActiveSubscriptionForOrganization.mockResolvedValue({
			id: "purchase_addon",
			provider: "test-provider",
			subscriptionId: "sub_addon",
			productId: "price-addon",
			priceId: "price-addon",
			status: "ACTIVE",
		});
		mockGetPlanSubscription.mockResolvedValueOnce({
			id: "purchase_1",
			provider: "test-provider",
			subscriptionId: "sub_123",
			productId: "price-pro",
			priceId: "price-pro",
			status: "ACTIVE",
		});

		await updateSeatsInOrganizationSubscription("org_1", 5);

		expect(mockGetPlanSubscription).toHaveBeenCalledWith({
			organizationId: "org_1",
		});
		expect(mockSetSubscriptionSeats).toHaveBeenCalledWith({
			subscriptionId: "sub_123",
			seats: 5,
		});
	});

	it.each([0, -1])(
		"skips the provider call when resolved seats < 1 (%i)",
		async (seats) => {
			await updateSeatsInOrganizationSubscription("org_1", seats);

			expect(mockSetSubscriptionSeats).not.toHaveBeenCalled();
			expect(mockWarn).toHaveBeenCalled();
		},
	);

	it("skips everything when the provider owns seat sync", async () => {
		mocks.provider = {
			id: "test-provider",
			ownsSeatSync: true,
			setSubscriptionSeats: mockSetSubscriptionSeats,
		};

		await updateSeatsInOrganizationSubscription("org_1", 5);

		expect(mockSetSubscriptionSeats).not.toHaveBeenCalled();
		expect(mockGetActiveSubscriptionForOrganization).not.toHaveBeenCalled();
	});

	it("skips everything when the provider is not seat-aware", async () => {
		mocks.provider = {
			id: "test-provider",
			ownsSeatSync: false,
		};

		await updateSeatsInOrganizationSubscription("org_1", 5);

		expect(mockGetActiveSubscriptionForOrganization).not.toHaveBeenCalled();
	});

	it("does not sync seats for a flat-priced (non seat-based) plan", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue({
			id: "purchase_1",
			provider: "test-provider",
			subscriptionId: "sub_flat",
			productId: "price-flat",
			priceId: "price-flat",
			status: "ACTIVE",
		});

		await updateSeatsInOrganizationSubscription("org_1", 7);

		expect(mockSetSubscriptionSeats).not.toHaveBeenCalled();
	});

	it("does not sync seats when the subscription's product maps to no plan", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue({
			id: "purchase_1",
			provider: "test-provider",
			subscriptionId: "sub_unknown",
			productId: "price-unknown",
			priceId: "price-unknown",
			status: "ACTIVE",
		});

		await updateSeatsInOrganizationSubscription("org_1", 7);

		expect(mockSetSubscriptionSeats).not.toHaveBeenCalled();
	});

	it("does not sync seats on a subscription owned by another provider", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue({
			id: "purchase_1",
			provider: "old-provider",
			subscriptionId: "sub_old",
			productId: "price-pro",
			priceId: "price-pro",
			status: "ACTIVE",
		});

		await updateSeatsInOrganizationSubscription("org_1", 7);

		expect(mockSetSubscriptionSeats).not.toHaveBeenCalled();
		expect(mockWarn).toHaveBeenCalled();
	});

	it("skips when the org has no active subscription", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(null);

		await updateSeatsInOrganizationSubscription("org_1", 5);

		expect(mockSetSubscriptionSeats).not.toHaveBeenCalled();
	});
});

describe("cancelAllSubscriptionsForOrganization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.provider = {
			id: "test-provider",
			ownsSeatSync: false,
			cancelSubscription: mockCancelSubscription,
		};
	});

	it("cancels every ACTIVE/TRIALING subscription purchase", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			{
				id: "p1",
				type: "SUBSCRIPTION",
				provider: "test-provider",
				subscriptionId: "sub_a",
				status: "ACTIVE",
			},
			{
				id: "p2",
				type: "SUBSCRIPTION",
				provider: "test-provider",
				subscriptionId: "sub_b",
				status: "TRIALING",
			},
			{
				id: "p3",
				type: "SUBSCRIPTION",
				provider: "test-provider",
				subscriptionId: "sub_c",
				status: "CANCELED",
			},
			{ id: "p4", type: "ONE_TIME", subscriptionId: null, status: "ACTIVE" },
		]);

		await cancelAllSubscriptionsForOrganization("org_1");

		expect(mockCancelSubscription).toHaveBeenCalledTimes(2);
		expect(mockCancelSubscription).toHaveBeenCalledWith("sub_a", {
			mode: "immediate",
		});
		expect(mockCancelSubscription).toHaveBeenCalledWith("sub_b", {
			mode: "immediate",
		});
	});

	it("cancels each subscription through the provider that owns it", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			{
				id: "p1",
				type: "SUBSCRIPTION",
				provider: "other-provider",
				subscriptionId: "sub_other",
				status: "ACTIVE",
			},
			{
				id: "p2",
				type: "SUBSCRIPTION",
				provider: "gone-provider",
				subscriptionId: "sub_gone",
				status: "ACTIVE",
			},
		]);

		await cancelAllSubscriptionsForOrganization("org_1");

		expect(mockOtherCancel).toHaveBeenCalledWith("sub_other", {
			mode: "immediate",
		});
		expect(mockCancelSubscription).not.toHaveBeenCalled();
		expect(mockWarn).toHaveBeenCalled();
	});

	it("continues after a per-item cancel failure", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			{
				id: "p1",
				type: "SUBSCRIPTION",
				provider: "test-provider",
				subscriptionId: "sub_a",
				status: "ACTIVE",
			},
			{
				id: "p2",
				type: "SUBSCRIPTION",
				provider: "test-provider",
				subscriptionId: "sub_b",
				status: "ACTIVE",
			},
		]);
		mockCancelSubscription
			.mockRejectedValueOnce(new Error("provider down"))
			.mockResolvedValueOnce(undefined);

		await expect(
			cancelAllSubscriptionsForOrganization("org_1"),
		).resolves.toBeUndefined();

		expect(mockCancelSubscription).toHaveBeenCalledTimes(2);
	});

	describe("cancelAllSubscriptionsForOrganizationOrThrow", () => {
		const active = (id: string, provider = "test-provider") => ({
			id,
			type: "SUBSCRIPTION",
			provider,
			subscriptionId: `sub_${id}`,
			status: "ACTIVE",
		});

		it("still tries every subscription, then rejects on a failure", async () => {
			mockGetPurchasesByOrganizationId.mockResolvedValue([
				active("a"),
				active("b"),
			]);
			mockCancelSubscription
				.mockRejectedValueOnce(new Error("provider down"))
				.mockResolvedValueOnce(undefined);

			await expect(
				cancelAllSubscriptionsForOrganizationOrThrow("org_1"),
			).rejects.toThrow("1 of 2 subscriptions could not be cancelled");
			expect(mockCancelSubscription).toHaveBeenCalledTimes(2);
		});

		it("rejects when a subscription's provider is not available", async () => {
			mockGetPurchasesByOrganizationId.mockResolvedValue([
				active("gone", "gone-provider"),
			]);

			await expect(
				cancelAllSubscriptionsForOrganizationOrThrow("org_1"),
			).rejects.toThrow("1 of 1 subscriptions could not be cancelled");
		});

		it("resolves when every cancel succeeds", async () => {
			mockGetPurchasesByOrganizationId.mockResolvedValue([active("a")]);
			mockCancelSubscription.mockResolvedValueOnce(undefined);

			await expect(
				cancelAllSubscriptionsForOrganizationOrThrow("org_1"),
			).resolves.toBeUndefined();
		});

		it("cancels every status that can still charge — not only active/trialing", async () => {
			mockGetPurchasesByOrganizationId.mockResolvedValue([
				{ ...active("past_due"), status: "PAST_DUE" },
				{ ...active("paused"), status: "PAUSED" },
				{ ...active("incomplete"), status: "INCOMPLETE" },
				{ ...active("scheduled"), status: "SCHEDULED_CANCEL" },
				{ ...active("canceled"), status: "CANCELED" },
				{ ...active("expired"), status: "EXPIRED" },
			]);
			mockCancelSubscription.mockResolvedValue(undefined);

			await cancelAllSubscriptionsForOrganizationOrThrow("org_1");

			expect(
				mockCancelSubscription.mock.calls.map(([id]) => id).sort(),
			).toEqual(["sub_incomplete", "sub_past_due", "sub_paused"]);
			expect(mockCancelSubscription).toHaveBeenCalledWith("sub_past_due", {
				mode: "immediate",
			});
		});

		it("counts a refused cancel as done when the provider reports the subscription ended", async () => {
			const getSubscriptionStatus = vi.fn().mockResolvedValue("EXPIRED");
			mocks.provider = { ...mocks.provider, getSubscriptionStatus };
			mockGetPurchasesByOrganizationId.mockResolvedValue([
				{ ...active("stale"), status: "INCOMPLETE" },
			]);
			mockCancelSubscription.mockRejectedValueOnce(
				new Error("subscription already expired"),
			);

			await expect(
				cancelAllSubscriptionsForOrganizationOrThrow("org_1"),
			).resolves.toBeUndefined();
			expect(getSubscriptionStatus).toHaveBeenCalledWith("sub_stale");
		});

		it("rejects a refused cancel when the provider still reports it billing", async () => {
			mocks.provider = {
				...mocks.provider,
				getSubscriptionStatus: vi.fn().mockResolvedValue("INCOMPLETE"),
			};
			mockGetPurchasesByOrganizationId.mockResolvedValue([
				{ ...active("open"), status: "INCOMPLETE" },
			]);
			mockCancelSubscription.mockRejectedValueOnce(new Error("provider down"));

			await expect(
				cancelAllSubscriptionsForOrganizationOrThrow("org_1"),
			).rejects.toThrow("1 of 1 subscriptions could not be cancelled");
		});
	});

	it("the lenient variant still cancels only active/trialing subscriptions", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			{
				id: "p1",
				type: "SUBSCRIPTION",
				provider: "test-provider",
				subscriptionId: "sub_past_due",
				status: "PAST_DUE",
			},
		]);

		await cancelAllSubscriptionsForOrganization("org_1");

		expect(mockCancelSubscription).not.toHaveBeenCalled();
	});
});

describe("reconcileOrganizationSeats", () => {
	const candidate = (overrides: Record<string, unknown> = {}) => ({
		purchaseId: "purchase_1",
		organizationId: "org_1",
		subscriptionId: "sub_123",
		provider: "test-provider",
		productId: "price-pro",
		priceId: "price-pro",
		quantity: 3,
		memberCount: 3,
		...overrides,
	});

	beforeEach(() => {
		vi.clearAllMocks();
		paymentsConfig.seatSync = "members";
		mocks.provider = {
			id: "test-provider",
			ownsSeatSync: false,
			setSubscriptionSeats: mockSetSubscriptionSeats,
			cancelSubscription: mockCancelSubscription,
		};
		mockGetActiveSubscriptionForOrganization.mockResolvedValue({
			id: "purchase_1",
			provider: "test-provider",
			subscriptionId: "sub_123",
			productId: "price-pro",
			priceId: "price-pro",
			status: "ACTIVE",
		});
	});

	it("syncs a subscription that bills fewer seats than the org has members", async () => {
		mockGetOrganizationSeatSubscriptions.mockResolvedValue([
			candidate({ quantity: 2, memberCount: 5 }),
		]);

		const result = await reconcileOrganizationSeats();

		expect(mockSetSubscriptionSeats).toHaveBeenCalledWith({
			subscriptionId: "sub_123",
			seats: 5,
		});
		expect(result).toEqual({ checked: 1, synced: 1, failed: 0 });
	});

	it("leaves a subscription whose seats match its members", async () => {
		mockGetOrganizationSeatSubscriptions.mockResolvedValue([candidate()]);

		const result = await reconcileOrganizationSeats();

		expect(mockSetSubscriptionSeats).not.toHaveBeenCalled();
		expect(result).toEqual({ checked: 1, synced: 0, failed: 0 });
	});

	it("skips a plan that is not seat-based", async () => {
		mockGetOrganizationSeatSubscriptions.mockResolvedValue([
			candidate({
				productId: "price-flat",
				priceId: "price-flat",
				quantity: 1,
				memberCount: 4,
			}),
		]);

		const result = await reconcileOrganizationSeats();

		expect(mockSetSubscriptionSeats).not.toHaveBeenCalled();
		expect(result).toEqual({ checked: 0, synced: 0, failed: 0 });
	});

	it("logs and counts a failed sync, then carries on with the next org", async () => {
		mockGetOrganizationSeatSubscriptions.mockResolvedValue([
			candidate({ organizationId: "org_1", quantity: 1, memberCount: 2 }),
			candidate({ organizationId: "org_2", quantity: 1, memberCount: 4 }),
		]);
		mockSetSubscriptionSeats
			.mockRejectedValueOnce(new Error("provider down"))
			.mockResolvedValueOnce(undefined);

		const result = await reconcileOrganizationSeats();

		expect(result).toEqual({ checked: 2, synced: 1, failed: 1 });
		expect(mockError).toHaveBeenCalledWith(
			expect.stringContaining("seat reconcile failed"),
			expect.objectContaining({ organizationId: "org_1" }),
		);
	});

	it("does nothing when seats do not follow members", async () => {
		paymentsConfig.seatSync = "none";
		mockGetOrganizationSeatSubscriptions.mockResolvedValue([
			candidate({ quantity: 1, memberCount: 9 }),
		]);

		const result = await reconcileOrganizationSeats();

		expect(mockGetOrganizationSeatSubscriptions).not.toHaveBeenCalled();
		expect(result).toEqual({ checked: 0, synced: 0, failed: 0 });
		paymentsConfig.seatSync = "members";
	});
});
