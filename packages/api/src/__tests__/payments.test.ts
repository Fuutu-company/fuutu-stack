import type { PlanId } from "@fuutu/payments/config";
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

const envOverrides = vi.hoisted(() => ({
	PAYMENTS_PRO_PRICE_ID: "price-pro-monthly" as string | undefined,
	PAYMENTS_PRO_YEARLY_PRICE_ID: "price-pro-yearly" as string | undefined,
}));

vi.mock("@fuutu/env/saas", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/env/saas")>();
	return {
		...actual,
		env: new Proxy(actual.env, {
			get(target, prop, receiver) {
				if (prop === "PAYMENTS_PRO_PRICE_ID") {
					return envOverrides.PAYMENTS_PRO_PRICE_ID;
				}
				if (prop === "PAYMENTS_PRO_YEARLY_PRICE_ID") {
					return envOverrides.PAYMENTS_PRO_YEARLY_PRICE_ID;
				}
				return Reflect.get(target, prop, receiver);
			},
		}),
	};
});

vi.mock("@fuutu/payments", () => ({
	resolvePaymentProvider: vi.fn(),
	isPaymentsEnabled: vi.fn().mockReturnValue(true),
	PaymentsDisabledError: class PaymentsDisabledError extends Error {},
	CREDIT_TOPUPS: [
		{
			id: "ai_tokens_100k",
			meterKey: "ai_tokens",
			amount: 100_000,
			displayPrice: "$10",
			priceIdEnvVar: "CREDITS_AI_TOKENS_100K_PRICE_ID",
		},
	],
}));

vi.mock("@fuutu/payments/config.server", () => ({
	getCreditTopupPriceId: vi.fn().mockReturnValue("price-topup-1"),
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

const { resolvePaymentProvider, PaymentsDisabledError, isPaymentsEnabled } =
	await import("@fuutu/payments");
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
	id: "12345678-1234-1234-8123-123456789abc",
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
		envOverrides.PAYMENTS_PRO_PRICE_ID = "price-pro-monthly";
		envOverrides.PAYMENTS_PRO_YEARLY_PRICE_ID = "price-pro-yearly";
	});

	it("creates a checkout link, resolving the price ID server-side", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		const result = await call(
			paymentsRouter.checkout.create,
			{ planId: "pro" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-pro-monthly",
			userId: "user-1",
			organizationId: undefined,
			successUrl: undefined,
			cancelUrl: undefined,
			customerEmail: "test@fuutu.local",
		});
		expect(result).toEqual({ url: "https://checkout.example.com" });
	});

	it("uses the yearly price ID when interval is year", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		await call(
			paymentsRouter.checkout.create,
			{ planId: "pro", interval: "year" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-pro-yearly",
			userId: "user-1",
			organizationId: undefined,
			successUrl: undefined,
			cancelUrl: undefined,
			customerEmail: "test@fuutu.local",
		});
	});

	it("fails cleanly when the yearly price env var is missing", async () => {
		envOverrides.PAYMENTS_PRO_YEARLY_PRICE_ID = undefined;
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);

		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: "pro", interval: "year" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("rejects a non-checkoutable plan (free) with BAD_REQUEST", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: "free" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("rejects a non-checkoutable plan (custom) with BAD_REQUEST", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: "enterprise" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("rejects an unknown plan ID", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				// invalid runtime value — a non-catalog plan must not reach the provider
				{ planId: "gold" as PlanId },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("fails cleanly when the price env var is missing", async () => {
		envOverrides.PAYMENTS_PRO_PRICE_ID = undefined;
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);

		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: "pro" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("maps PaymentsDisabledError to NOT_IMPLEMENTED", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockRejectedValue(
			new PaymentsDisabledError("provider not enabled"),
		);

		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: "pro" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
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
				planId: "pro",
				organizationId: "12345678-1234-1234-8123-123456789abc",
				successUrl: "/success",
				cancelUrl: "/cancel",
			},
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-pro-monthly",
			userId: "user-1",
			organizationId: "12345678-1234-1234-8123-123456789abc",
			successUrl: "http://localhost:3000/success",
			cancelUrl: "http://localhost:3000/cancel",
			customerEmail: "test@fuutu.local",
		});
	});

	it("sanitizes external successUrl to fallback", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		await call(
			paymentsRouter.checkout.create,
			{ planId: "pro", successUrl: "https://evil.com/steal" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-pro-monthly",
			userId: "user-1",
			organizationId: undefined,
			successUrl: "http://localhost:3000/",
			cancelUrl: undefined,
			customerEmail: "test@fuutu.local",
		});
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: "pro" },
				{
					context: unauthenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("payments.topupPackages.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns catalog data only — no priceId or env var names leak to clients", async () => {
		const result = await call(
			paymentsRouter.topupPackages.list,
			{},
			{ context: authenticatedContext },
		);

		expect(result.packages).toEqual([
			{
				id: "ai_tokens_100k",
				meterKey: "ai_tokens",
				amount: 100_000,
				displayPrice: "$10",
				popular: undefined,
			},
		]);
		for (const pkg of result.packages) {
			expect(pkg).not.toHaveProperty("priceId");
			expect(pkg).not.toHaveProperty("priceIdEnvVar");
		}
	});

	it("omits packages whose price ID is not configured", async () => {
		const { getCreditTopupPriceId } = await import(
			"@fuutu/payments/config.server"
		);
		vi.mocked(getCreditTopupPriceId).mockReturnValueOnce(undefined);

		const result = await call(
			paymentsRouter.topupPackages.list,
			{},
			{ context: authenticatedContext },
		);

		expect(result.packages).toEqual([]);
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				paymentsRouter.topupPackages.list,
				{},
				{
					context: unauthenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("payments.topupCheckout.create", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("maps PaymentsDisabledError to NOT_IMPLEMENTED", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockRejectedValue(
			new PaymentsDisabledError("provider not enabled"),
		);

		await expect(
			call(
				paymentsRouter.topupCheckout.create,
				{ topupId: "ai_tokens_100k" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
	});
});

describe("payments.portal.open", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a portal link for an organization with a customer ID", async () => {
		mockOrgMembership();
		vi.mocked(getOrganizationById).mockResolvedValue({
			id: "12345678-1234-1234-8123-123456789abc",
			paymentsCustomerId: "cust-123",
		} as never);
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCustomerPortalLink.mockResolvedValue({
			url: "https://portal.example.com",
		});

		const result = await call(
			paymentsRouter.portal.open,
			{ organizationId: "12345678-1234-1234-8123-123456789abc" },
			{ context: authenticatedContext },
		);

		expect(getOrganizationById).toHaveBeenCalledWith(
			"12345678-1234-1234-8123-123456789abc",
		);
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
				{ organizationId: "12345678-1234-1234-8123-123456789abc" },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("throws BAD_REQUEST when org has no customer ID", async () => {
		mockOrgMembership();
		vi.mocked(getOrganizationById).mockResolvedValue({
			id: "12345678-1234-1234-8123-123456789abc",
			paymentsCustomerId: null,
		} as never);

		await expect(
			call(
				paymentsRouter.portal.open,
				{ organizationId: "12345678-1234-1234-8123-123456789abc" },
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

	it("maps PaymentsDisabledError to NOT_IMPLEMENTED", async () => {
		vi.mocked(getActiveSubscriptionForUser).mockResolvedValue({
			id: "sub-1",
			customerId: "cust-user-123",
			status: "ACTIVE",
		} as never);
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCustomerPortalLink.mockRejectedValue(
			new PaymentsDisabledError("provider not enabled"),
		);

		await expect(
			call(paymentsRouter.portal.open, {}, { context: authenticatedContext }),
		).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
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
			{ organizationId: "12345678-1234-1234-8123-123456789abc" },
			{ context: authenticatedContext },
		);

		expect(getActiveSubscriptionForOrganization).toHaveBeenCalledWith(
			"12345678-1234-1234-8123-123456789abc",
		);
	});
});

describe("payments.subscription.cancel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(isPaymentsEnabled).mockReturnValue(true);
	});

	it("throws NOT_IMPLEMENTED when payments are disabled", async () => {
		// Disabled installs must short-circuit to 501 — the noop provider id
		// would otherwise miss the purchase lookup and surface NOT_FOUND.
		vi.mocked(isPaymentsEnabled).mockReturnValue(false);

		await expect(
			call(
				paymentsRouter.subscription.cancel,
				{ subscriptionId: "sub-1" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
		expect(getPurchaseByProviderSubscriptionId).not.toHaveBeenCalled();
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
			organizationId: "12345678-1234-1234-8123-123456789abc",
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

	it("throws NOT_FOUND when subscription not found", async () => {
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
		).rejects.toMatchObject({ code: "NOT_FOUND" });
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

	it("maps PaymentsDisabledError to NOT_IMPLEMENTED", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-1",
			userId: "user-1",
			organizationId: null,
		} as never);
		mockProvider.cancelSubscription.mockRejectedValue(
			new PaymentsDisabledError("provider not enabled"),
		);

		await expect(
			call(
				paymentsRouter.subscription.cancel,
				{ subscriptionId: "sub-1" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
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
			{
				organizationId: "12345678-1234-1234-8123-123456789abc",
				page: 1,
				limit: 10,
			},
			{ context: authenticatedContext },
		);

		expect(listInvoicesByOrg).toHaveBeenCalledWith(
			"12345678-1234-1234-8123-123456789abc",
			{
				take: 10,
				skip: 0,
			},
		);
		expect(countInvoicesByOrg).toHaveBeenCalledWith(
			"12345678-1234-1234-8123-123456789abc",
		);
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
			{
				organizationId: "12345678-1234-1234-8123-123456789abc",
				page: 2,
				limit: 10,
			},
			{ context: authenticatedContext },
		);

		expect(listInvoicesByOrg).toHaveBeenCalledWith(
			"12345678-1234-1234-8123-123456789abc",
			{
				take: 10,
				skip: 10,
			},
		);
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
