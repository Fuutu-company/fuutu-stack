import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { paymentsRouter } from "../modules/payments/router";

vi.mock("@fuutu/payments/plans", () => ({
	buildPricingTiers: vi
		.fn()
		.mockReturnValue([
			{ id: "free", name: "Free", price: "$0", features: [], featureIds: [] },
		]),
}));

vi.mock("@fuutu/payments", () => ({
	resolvePaymentProvider: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	getOrganizationById: vi.fn(),
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization: vi.fn(),
	getPurchaseByProviderSubscriptionId: vi.fn(),
	listInvoicesByOrg: vi.fn(),
	listInvoicesByUser: vi.fn(),
	countInvoicesByOrg: vi.fn(),
	countInvoicesByUser: vi.fn(),
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const { resolvePaymentProvider } = await import("@fuutu/payments");
const { buildPricingTiers } = await import("@fuutu/payments/plans");
const {
	getOrganizationById,
	getActiveSubscriptionForUser,
	getActiveSubscriptionForOrganization,
	getPurchaseByProviderSubscriptionId,
	listInvoicesByOrg,
	listInvoicesByUser,
	countInvoicesByOrg,
	countInvoicesByUser,
} = await import("@fuutu/db");

const { auth } = await import("@fuutu/auth");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const mockProvider = {
	id: "polar",
	createCheckoutLink: vi.fn(),
	createCustomerPortalLink: vi.fn(),
	cancelSubscription: vi.fn(),
	webhookHandler: vi.fn(),
	setSubscriptionSeats: vi.fn(),
};

const orgFixture = {
	id: "org-1",
	name: "Acme",
	slug: "acme",
	createdAt: new Date("2024-01-01"),
	members: [{ userId: "user-1", role: "owner", id: "member-1" }],
	invitations: [],
};

function mockOrgMembership() {
	vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
		orgFixture as never,
	);
}

describe("payments.plans.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns pricing tiers (public, no auth needed)", async () => {
		vi.mocked(buildPricingTiers).mockReturnValue([
			{ id: "pro", name: "Pro", price: "$19", features: [], featureIds: [] },
		] as never);

		const result = await call(paymentsRouter.plans.list, undefined, {
			context: unauthenticatedContext,
		});

		expect(buildPricingTiers).toHaveBeenCalledOnce();
		expect(result).toEqual({
			items: [
				{ id: "pro", name: "Pro", price: "$19", features: [], featureIds: [] },
			],
		});
	});
});

describe("payments.checkout.create", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a checkout link", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		const result = await call(
			paymentsRouter.checkout.create,
			{ priceId: "price-123" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-123",
			userId: "user-1",
			organizationId: undefined,
			successUrl: undefined,
			cancelUrl: undefined,
		});
		expect(result).toEqual({ url: "https://checkout.example.com" });
	});

	it("passes organizationId and sanitized same-origin URLs when provided", async () => {
		mockOrgMembership();
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		await call(
			paymentsRouter.checkout.create,
			{
				priceId: "price-123",
				organizationId: "org-1",
				successUrl: "/success",
				cancelUrl: "/cancel",
			},
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-123",
			userId: "user-1",
			organizationId: "org-1",
			successUrl: "http://localhost:3000/success",
			cancelUrl: "http://localhost:3000/cancel",
		});
	});

	it("sanitizes external successUrl to fallback", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		await call(
			paymentsRouter.checkout.create,
			{ priceId: "price-123", successUrl: "https://evil.com/steal" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-123",
			userId: "user-1",
			organizationId: undefined,
			successUrl: "http://localhost:3000/",
			cancelUrl: undefined,
		});
	});

	it("rejects empty priceId", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ priceId: "" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ priceId: "price-123" },
				{
					context: unauthenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("payments.portal.open", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a portal link for an organization with a customer ID", async () => {
		mockOrgMembership();
		vi.mocked(getOrganizationById).mockResolvedValue({
			id: "org-1",
			paymentsCustomerId: "cust-123",
		} as never);
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCustomerPortalLink.mockResolvedValue({
			url: "https://portal.example.com",
		});

		const result = await call(
			paymentsRouter.portal.open,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(getOrganizationById).toHaveBeenCalledWith("org-1");
		expect(mockProvider.createCustomerPortalLink).toHaveBeenCalledWith({
			customerId: "cust-123",
			returnUrl: undefined,
		});
		expect(result).toEqual({ url: "https://portal.example.com" });
	});

	it("throws NOT_FOUND when organization does not exist", async () => {
		mockOrgMembership();
		vi.mocked(getOrganizationById).mockResolvedValue(null as never);

		await expect(
			call(
				paymentsRouter.portal.open,
				{ organizationId: "org-1" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("throws BAD_REQUEST when org has no customer ID", async () => {
		mockOrgMembership();
		vi.mocked(getOrganizationById).mockResolvedValue({
			id: "org-1",
			paymentsCustomerId: null,
		} as never);

		await expect(
			call(
				paymentsRouter.portal.open,
				{ organizationId: "org-1" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("creates a portal link for a user-level subscription", async () => {
		vi.mocked(getActiveSubscriptionForUser).mockResolvedValue({
			id: "sub-1",
			customerId: "cust-user-123",
			status: "ACTIVE",
		} as never);
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCustomerPortalLink.mockResolvedValue({
			url: "https://portal.example.com",
		});

		const result = await call(
			paymentsRouter.portal.open,
			{},
			{ context: authenticatedContext },
		);

		expect(getActiveSubscriptionForUser).toHaveBeenCalledWith("user-1");
		expect(mockProvider.createCustomerPortalLink).toHaveBeenCalledWith({
			customerId: "cust-user-123",
			returnUrl: undefined,
		});
		expect(result).toEqual({ url: "https://portal.example.com" });
	});

	it("throws NOT_FOUND when user has no active subscription", async () => {
		vi.mocked(getActiveSubscriptionForUser).mockResolvedValue(null as never);

		await expect(
			call(paymentsRouter.portal.open, {}, { context: authenticatedContext }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("throws NOT_FOUND when user subscription has no customer ID", async () => {
		vi.mocked(getActiveSubscriptionForUser).mockResolvedValue({
			id: "sub-1",
			customerId: null,
			status: "ACTIVE",
		} as never);

		await expect(
			call(paymentsRouter.portal.open, {}, { context: authenticatedContext }),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});

describe("payments.subscription.status", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns active status for user subscription", async () => {
		vi.mocked(getActiveSubscriptionForUser).mockResolvedValue({
			id: "sub-1",
			status: "ACTIVE",
		} as never);

		const result = await call(
			paymentsRouter.subscription.status,
			{},
			{ context: authenticatedContext },
		);

		expect(getActiveSubscriptionForUser).toHaveBeenCalledWith("user-1");
		expect(result).toEqual({
			active: true,
			subscription: { id: "sub-1", status: "ACTIVE" },
		});
	});

	it("returns inactive status when no subscription", async () => {
		vi.mocked(getActiveSubscriptionForUser).mockResolvedValue(null as never);

		const result = await call(
			paymentsRouter.subscription.status,
			{},
			{ context: authenticatedContext },
		);

		expect(result).toEqual({ active: false, subscription: null });
	});

	it("queries by organizationId when provided", async () => {
		mockOrgMembership();
		vi.mocked(getActiveSubscriptionForOrganization).mockResolvedValue({
			id: "sub-2",
			status: "ACTIVE",
		} as never);

		await call(
			paymentsRouter.subscription.status,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(getActiveSubscriptionForOrganization).toHaveBeenCalledWith("org-1");
	});
});

describe("payments.subscription.cancel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("cancels a subscription owned by the user", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-1",
			userId: "user-1",
			organizationId: null,
		} as never);
		mockProvider.cancelSubscription.mockResolvedValue(undefined);

		const result = await call(
			paymentsRouter.subscription.cancel,
			{ subscriptionId: "sub-1" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.cancelSubscription).toHaveBeenCalledWith("sub-1");
		expect(result).toEqual({ success: true });
	});

	it("cancels a subscription owned by an org the user belongs to", async () => {
		mockOrgMembership();
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-2",
			userId: null,
			organizationId: "org-1",
		} as never);
		mockProvider.cancelSubscription.mockResolvedValue(undefined);

		const result = await call(
			paymentsRouter.subscription.cancel,
			{ subscriptionId: "sub-2" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.cancelSubscription).toHaveBeenCalledWith("sub-2");
		expect(result).toEqual({ success: true });
	});

	it("throws FORBIDDEN when subscription belongs to another user", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-3",
			userId: "user-2",
			organizationId: null,
		} as never);

		await expect(
			call(
				paymentsRouter.subscription.cancel,
				{ subscriptionId: "sub-3" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("throws FORBIDDEN when subscription not found", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue(
			null as never,
		);

		await expect(
			call(
				paymentsRouter.subscription.cancel,
				{ subscriptionId: "sub-missing" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("rejects empty subscriptionId", async () => {
		await expect(
			call(
				paymentsRouter.subscription.cancel,
				{ subscriptionId: "" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});
});

describe("payments.invoices.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists invoices for an organization with pagination", async () => {
		mockOrgMembership();
		vi.mocked(listInvoicesByOrg).mockResolvedValue([
			{ id: "inv-1", amount: 1900, status: "paid" },
		] as never);
		vi.mocked(countInvoicesByOrg).mockResolvedValue(1);

		const result = await call(
			paymentsRouter.invoices.list,
			{ organizationId: "org-1", page: 1, limit: 10 },
			{ context: authenticatedContext },
		);

		expect(listInvoicesByOrg).toHaveBeenCalledWith("org-1", {
			take: 10,
			skip: 0,
		});
		expect(countInvoicesByOrg).toHaveBeenCalledWith("org-1");
		expect(result).toEqual({
			items: [{ id: "inv-1", amount: 1900, status: "paid" }],
			page: 1,
			limit: 10,
			total: 1,
			totalPages: 1,
		});
	});

	it("lists invoices for the current user when no orgId", async () => {
		vi.mocked(listInvoicesByUser).mockResolvedValue([
			{ id: "inv-2", amount: 0, status: "open" },
		] as never);
		vi.mocked(countInvoicesByUser).mockResolvedValue(1);

		const result = await call(
			paymentsRouter.invoices.list,
			{ page: 1, limit: 50 },
			{ context: authenticatedContext },
		);

		expect(listInvoicesByUser).toHaveBeenCalledWith("user-1", {
			take: 50,
			skip: 0,
		});
		expect(countInvoicesByUser).toHaveBeenCalledWith("user-1");
		expect(result.items).toHaveLength(1);
		expect(result.total).toBe(1);
		expect(result.totalPages).toBe(1);
	});

	it("computes correct skip for page 2", async () => {
		mockOrgMembership();
		vi.mocked(listInvoicesByOrg).mockResolvedValue([] as never);
		vi.mocked(countInvoicesByOrg).mockResolvedValue(25);

		const result = await call(
			paymentsRouter.invoices.list,
			{ organizationId: "org-1", page: 2, limit: 10 },
			{ context: authenticatedContext },
		);

		expect(listInvoicesByOrg).toHaveBeenCalledWith("org-1", {
			take: 10,
			skip: 10,
		});
		expect(result.totalPages).toBe(3);
	});

	it("rejects limit exceeding 100", async () => {
		await expect(
			call(
				paymentsRouter.invoices.list,
				{ limit: 101 },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});
});
