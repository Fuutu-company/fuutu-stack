import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";

/**
 * Billing reads show the PLAN subscription, never a newer add-on
 * (`Plan.addonOf`): the billing UI would otherwise present the add-on as
 * the current plan (and offer to cancel the wrong subscription).
 */

vi.mock("@fuutu/payments/config", async (importOriginal) => {
	const actual = {
		...(await importOriginal<typeof import("@fuutu/payments/config")>()),
		...(await import("@fuutu/test-utils")).planCatalogFixture,
	};
	return {
		...actual,
		PLANS: {
			...actual.PLANS,
			proSeats: {
				amount: 500,
				currency: "usd",
				billingType: "subscription",
				interval: "month",
				addonOf: "pro",
				displayPrice: "$5",
				showInSaas: true,
				showInMarketing: false,
			},
		},
	};
});

vi.mock("@fuutu/payments/config.server", () => {
	const plans: Record<string, { planId: string; interval: "month" | "year" }> =
		{
			price_pro: { planId: "pro", interval: "month" },
			price_pro_notrial: { planId: "pro", interval: "year" },
			price_seats: { planId: "proSeats", interval: "month" },
		};
	return {
		getPlanForProductId: (productId: string) => plans[productId],
		getPlanIdForProductId: (productId: string) => plans[productId]?.planId,
		getOneTimePlanPriceIds: () => [],
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

const BASE = {
	id: "purchase_base",
	type: "SUBSCRIPTION",
	subscriptionId: "sub_base",
	productId: "price_pro",
	priceId: "price_pro",
	customerId: "cus_base",
	status: "ACTIVE",
	currentPeriodEnd: new Date("2026-12-01T00:00:00Z"),
};
const ADDON = {
	...BASE,
	id: "purchase_addon",
	subscriptionId: "sub_addon",
	productId: "price_seats",
	priceId: "price_seats",
	customerId: "cus_addon",
	currentPeriodEnd: new Date("2027-01-15T00:00:00Z"),
};

vi.mock("@fuutu/db", () => ({
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
	getActiveSubscriptionsForOwner: vi.fn(),
	getActiveOneTimePlanPurchase: vi.fn().mockResolvedValue(null),
	getOrganizationById: vi.fn(),
	countOrganizationsForUser: vi.fn().mockResolvedValue(0),
	countApiKeys: vi.fn().mockResolvedValue(0),
	listApiKeys: vi.fn().mockResolvedValue([]),
	listAuditLogs: vi.fn().mockResolvedValue([]),
	listAuditLogDates: vi.fn().mockResolvedValue([]),
	listInvoicesByUser: vi.fn().mockResolvedValue([]),
	getCreditEventsForUser: vi.fn().mockResolvedValue([]),
}));

vi.mock("@fuutu/credits", () => ({
	getCreditBalanceSummary: vi.fn().mockResolvedValue([]),
}));
vi.mock("@fuutu/ai", () => ({ resolveAIProvider: vi.fn() }));

const db = await import("@fuutu/db");
const { paymentsRouter } = await import("../modules/payments/router");
const { dashboardRouter } = await import("../modules/dashboard/router");

const context = makeSession<Context>(makeUser({ id: "user-addon" }));

beforeEach(() => {
	vi.clearAllMocks();
	// The add-on is the newest access-gating subscription.
	vi.mocked(db.getActiveSubscriptionForUser).mockResolvedValue(ADDON as never);
	vi.mocked(db.getActiveSubscriptionsForOwner).mockResolvedValue([
		ADDON,
		BASE,
	] as never);
	mockPortal.mockResolvedValue({ url: "https://portal.example.com" });
});

describe("billing reads with a stacked add-on", () => {
	it("payments.subscription.active returns the plan subscription", async () => {
		const result = await call(
			paymentsRouter.subscription.active,
			{},
			{ context },
		);
		expect(result).toMatchObject({ subscriptionId: "sub_base" });
		expect(db.getActiveSubscriptionsForOwner).toHaveBeenCalledWith({
			userId: "user-addon",
		});
	});

	it("payments.subscription.active resolves plan and interval on the server", async () => {
		const result = await call(
			paymentsRouter.subscription.active,
			{},
			{ context },
		);
		expect(result).toMatchObject({ planId: "pro", interval: "month" });
	});

	it("payments.subscription.active resolves a no-trial product to its plan", async () => {
		vi.mocked(db.getActiveSubscriptionForUser).mockResolvedValueOnce({
			...BASE,
			productId: "price_pro_notrial",
			priceId: "price_pro_notrial",
		} as never);
		const result = await call(
			paymentsRouter.subscription.active,
			{},
			{ context },
		);
		expect(result).toMatchObject({ planId: "pro", interval: "year" });
	});

	it("payments.subscription.status returns the plan subscription", async () => {
		const result = await call(
			paymentsRouter.subscription.status,
			{},
			{ context },
		);
		expect(result.active).toBe(true);
		expect(result.subscription).toMatchObject({ subscriptionId: "sub_base" });
	});

	it("payments.portal.open uses the plan subscription's customer", async () => {
		await call(paymentsRouter.portal.open, {}, { context });
		expect(mockPortal).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cus_base" }),
		);
	});

	it("dashboard.overview shows the plan subscription's renewal date", async () => {
		const result = await call(dashboardRouter.overview, {}, { context });
		expect(JSON.stringify(result)).toContain("2026-12-01T00:00:00.000Z");
		expect(JSON.stringify(result)).not.toContain("2027-01-15");
	});
});
