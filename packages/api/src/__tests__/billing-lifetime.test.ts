import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

/**
 * One-time plan purchases (`billingType: "one_time"`, lifetime access) in
 * the billing reads: the account Billing tab used to know subscriptions
 * only, so a lifetime buyer saw "No active subscription · Free", was
 * offered the plan again and could not open the portal for receipts.
 */

vi.mock("@fuutu/payments/config", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/payments/config")>()),
	...(await import("@fuutu/test-utils")).planCatalogFixture,
}));

vi.mock("@fuutu/payments/config.server", () => {
	const plans: Record<string, { planId: string; interval: null }> = {
		price_lifetime: { planId: "pro", interval: null },
	};
	return {
		getPlanForProductId: (productId: string) => plans[productId],
		getPlanIdForProductId: (productId: string) => plans[productId]?.planId,
		getOneTimePlanPriceIds: () => ["price_lifetime"],
	};
});

const mockPortal = vi.hoisted(() => vi.fn());
vi.mock("@fuutu/payments", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/payments")>()),
	resolvePaymentProvider: () => ({
		id: "creem",
		createCustomerPortalLink: mockPortal,
	}),
}));

vi.mock("@fuutu/db", () => ({
	getActiveSubscriptionForUser: vi.fn().mockResolvedValue(null),
	getActiveSubscriptionForOrganization: vi.fn().mockResolvedValue(null),
	getActiveSubscriptionsForOwner: vi.fn().mockResolvedValue([]),
	getActiveOneTimePlanPurchase: vi.fn().mockResolvedValue(null),
	getOrganizationById: vi.fn(),
	getPurchasesByOrganizationId: vi.fn().mockResolvedValue([]),
	getUserById: vi.fn(),
}));

const LIFETIME = {
	id: "purchase_lifetime",
	type: "ONE_TIME",
	status: "ACTIVE",
	provider: "creem",
	productId: "price_lifetime",
	priceId: "price_lifetime",
	customerId: "cus_lifetime",
	subscriptionId: null,
	currentPeriodEnd: null,
	createdAt: new Date("2026-10-03T12:00:00Z"),
};

const db = await import("@fuutu/db");
const { paymentsRouter } = await import("../modules/payments/router");

const context = makeSession<Context>(makeUser({ id: "user-lifetime" }));

beforeEach(() => {
	vi.clearAllMocks();
	vi.mocked(db.getActiveOneTimePlanPurchase).mockResolvedValue(null);
	mockPortal.mockResolvedValue({ url: "https://portal.example.com" });
});

describe("payments.subscription.lifetime", () => {
	it("is null without a one-time plan purchase", async () => {
		const result = await call(
			paymentsRouter.subscription.lifetime,
			{},
			{ context },
		);
		expect(result).toBeNull();
	});

	it("returns the plan, the purchase date and whether receipts exist", async () => {
		vi.mocked(db.getActiveOneTimePlanPurchase).mockResolvedValue(
			LIFETIME as never,
		);
		const result = await call(
			paymentsRouter.subscription.lifetime,
			{},
			{ context },
		);
		expect(result).toEqual({
			id: "purchase_lifetime",
			planId: "pro",
			purchasedAt: LIFETIME.createdAt,
			receipts: true,
		});
		expect(db.getActiveOneTimePlanPurchase).toHaveBeenCalledWith(
			{ userId: "user-lifetime" },
			["price_lifetime"],
		);
	});

	it("reports no receipts without a provider customer", async () => {
		vi.mocked(db.getActiveOneTimePlanPurchase).mockResolvedValue({
			...LIFETIME,
			customerId: null,
		} as never);
		const result = await call(
			paymentsRouter.subscription.lifetime,
			{},
			{ context },
		);
		expect(result).toMatchObject({ receipts: false });
	});
});

describe("payments.portal.open for a lifetime buyer", () => {
	it("opens the portal of the one-time purchase's customer (receipts)", async () => {
		vi.mocked(db.getActiveOneTimePlanPurchase).mockResolvedValue(
			LIFETIME as never,
		);
		await call(paymentsRouter.portal.open, {}, { context });
		expect(mockPortal).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cus_lifetime" }),
		);
	});

	it("still refuses without a subscription or a one-time purchase", async () => {
		await expect(
			call(paymentsRouter.portal.open, {}, { context }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
		expect(mockPortal).not.toHaveBeenCalled();
	});
});
