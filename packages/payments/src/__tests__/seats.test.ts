import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockProviderShape {
	id: string;
	ownsSeatSync?: boolean;
	setSubscriptionSeats?: (input: {
		subscriptionId: string;
		seats: number;
	}) => Promise<void>;
	cancelSubscription?: (subscriptionId: string) => Promise<void>;
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

vi.mock("@fuutu/db", () => ({
	getActiveSubscriptionForOrganization:
		mockGetActiveSubscriptionForOrganization,
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
}));

const mockWarn = vi.fn();
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: mockWarn,
		error: vi.fn(),
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

const {
	updateSeatsInOrganizationSubscription,
	cancelAllSubscriptionsForOrganization,
} = await import("../seats");

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
		expect(mockCancelSubscription).toHaveBeenCalledWith("sub_a");
		expect(mockCancelSubscription).toHaveBeenCalledWith("sub_b");
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

		expect(mockOtherCancel).toHaveBeenCalledWith("sub_other");
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
});
