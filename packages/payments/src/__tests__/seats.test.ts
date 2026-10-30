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

const mockSetSubscriptionSeats = vi.fn();
const mockCancelSubscription = vi.fn();

vi.mock("../resolve", () => ({
	resolvePaymentProvider: () => mocks.provider,
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
			subscriptionId: "sub_123",
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
				subscriptionId: "sub_a",
				status: "ACTIVE",
			},
			{
				id: "p2",
				type: "SUBSCRIPTION",
				subscriptionId: "sub_b",
				status: "TRIALING",
			},
			{
				id: "p3",
				type: "SUBSCRIPTION",
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

	it("continues after a per-item cancel failure", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			{
				id: "p1",
				type: "SUBSCRIPTION",
				subscriptionId: "sub_a",
				status: "ACTIVE",
			},
			{
				id: "p2",
				type: "SUBSCRIPTION",
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
