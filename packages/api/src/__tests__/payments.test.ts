import type { PlanId } from "@fuutu/payments/config";
import { fixturePlanId, makeSession, makeUser } from "@fuutu/test-utils";
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

// Per-test overrides on PLANS.pro (e.g. billingType) — the kit catalog
// ships no one-time plan to exercise.
const proPlanOverrides = vi.hoisted(
	(): { current: Record<string, unknown> } => ({ current: {} }),
);

vi.mock("@fuutu/payments/config", async (importOriginal) => {
	// Fixed kit plan catalog (@fuutu/test-utils), not the app's PLANS.
	const actual = {
		...(await importOriginal<typeof import("@fuutu/payments/config")>()),
		...(await import("@fuutu/test-utils")).planCatalogFixture,
	};
	return {
		...actual,
		PLANS: {
			...actual.PLANS,
			pro: new Proxy(actual.PLANS.pro, {
				get(target, prop, receiver) {
					if (typeof prop === "string" && prop in proPlanOverrides.current) {
						return proPlanOverrides.current[prop];
					}
					return Reflect.get(target, prop, receiver);
				},
			}),
		},
	};
});

vi.mock("@fuutu/payments", async () => {
	const db = await import("@fuutu/db");
	return {
		// Same lookup the kit does for a catalog without add-ons.
		getPlanSubscription: (
			owner: { userId: string } | { organizationId: string },
		) =>
			"organizationId" in owner
				? db.getActiveSubscriptionForOrganization(owner.organizationId)
				: db.getActiveSubscriptionForUser(owner.userId),
		// The kit default for a plan with a trial.
		assertCheckoutAllowed: vi.fn().mockResolvedValue({ trial: true }),
		CheckoutRejectedError: class CheckoutRejectedError extends Error {},
		resolvePaymentProvider: vi.fn(),
		isPaymentsEnabled: vi.fn().mockReturnValue(true),
		PaymentsDisabledError: class PaymentsDisabledError extends Error {},
		WebhookConfigError: class WebhookConfigError extends Error {},
		// Same shape and name check as @fuutu/payments (cross-bundle safe).
		ProviderRequestError: class ProviderRequestError extends Error {
			readonly kind: string;
			constructor(message: string, kind: string) {
				super(message);
				this.name = "ProviderRequestError";
				this.kind = kind;
			}
		},
		isProviderRequestError: (err: unknown) =>
			err instanceof Error &&
			err.name === "ProviderRequestError" &&
			typeof (err as { kind?: unknown }).kind === "string",
		CREDIT_TOPUPS: [
			{
				id: "ai_tokens_100k",
				meterKey: "ai_tokens",
				amount: 100_000,
				displayPrice: "$10",
				priceIdEnvVar: "CREDITS_AI_TOKENS_100K_PRICE_ID",
			},
		],
	};
});

vi.mock("@fuutu/payments/config.server", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@fuutu/payments/config.server")>();
	return {
		...actual,
		getCreditTopupPriceId: vi.fn().mockReturnValue("price-topup-1"),
	};
});

vi.mock("@fuutu/db", () => ({
	getOrganizationById: vi.fn(),
	getPurchasesByOrganizationId: vi.fn().mockResolvedValue([]),
	getUserById: vi.fn().mockResolvedValue(null),
	countOrganizationMembers: vi.fn().mockResolvedValue(1),
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

const {
	assertCheckoutAllowed,
	resolvePaymentProvider,
	PaymentsDisabledError,
	WebhookConfigError,
	ProviderRequestError,
	isPaymentsEnabled,
} = await import("@fuutu/payments");
const { buildPricingTiers } = await import("@fuutu/payments/plans");
const {
	getOrganizationById,
	getPurchasesByOrganizationId,
	getUserById,
	countOrganizationMembers,
	getActiveSubscriptionForUser,
	getActiveSubscriptionForOrganization,
	getPurchaseByProviderSubscriptionId,
	listInvoicesByOrg,
	listInvoicesByUser,
	countInvoicesByOrg,
	countInvoicesByUser,
} = await import("@fuutu/db");

const { auth } = await import("@fuutu/auth");

// Kit suite: the credits module on — an app may ship config.features.credits off.
(await import("@fuutu/payments/config")).paymentsConfig.creditsEnabled = true;

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);
// Own user so these cases do not eat the shared paymentsMutation
// rate-limit budget of `authenticatedContext`.
const configErrorContext = makeSession<Context>(
	makeUser({ id: "user-config-error" }),
);

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
		proPlanOverrides.current = {};
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
			{ planId: fixturePlanId<PlanId>("pro") },
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-pro-monthly",
			userId: "user-1",
			organizationId: undefined,
			successUrl: undefined,
			cancelUrl: undefined,
			customerEmail: "test@fuutu.local",
			trial: true,
			trialDays: 14,
		});
		expect(result).toEqual({ url: "https://checkout.example.com" });
	});

	it("sends no trial when the plan declares none", async () => {
		proPlanOverrides.current = { trialDays: undefined };
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		await call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro") },
			{ context: authenticatedContext },
		);

		const input = mockProvider.createCheckoutLink.mock.calls[0]?.[0];
		expect(input?.trialDays).toBeUndefined();
	});

	it("checks out a one-time plan in payment mode without a trial", async () => {
		proPlanOverrides.current = { billingType: "one_time" };
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		await call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro") },
			{ context: authenticatedContext },
		);

		const input = mockProvider.createCheckoutLink.mock.calls[0]?.[0];
		expect(input).toMatchObject({
			priceId: "price-pro-monthly",
			metadata: { mode: "payment" },
		});
		expect(input?.trialDays).toBeUndefined();
	});

	it("uses the yearly price ID when interval is year", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		await call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro"), interval: "year" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-pro-yearly",
			userId: "user-1",
			organizationId: undefined,
			successUrl: undefined,
			cancelUrl: undefined,
			customerEmail: "test@fuutu.local",
			trial: true,
			trialDays: 14,
		});
	});

	it("fails cleanly when the yearly price env var is missing", async () => {
		envOverrides.PAYMENTS_PRO_YEARLY_PRICE_ID = undefined;
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);

		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro"), interval: "year" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("rejects a non-checkoutable plan (free) with BAD_REQUEST", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("free") },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
	});

	it("rejects a non-checkoutable plan (custom) with BAD_REQUEST", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("enterprise") },
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
				{ planId: fixturePlanId<PlanId>("pro") },
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
				{ planId: fixturePlanId<PlanId>("pro") },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
	});

	it("maps a provider misconfiguration to SERVICE_UNAVAILABLE without leaking details", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockRejectedValue(
			new WebhookConfigError("[payments:creem] CREEM_API_KEY is not set."),
		);

		const error = await call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro") },
			{ context: configErrorContext },
		).catch((err: unknown) => err);

		expect(error).toMatchObject({
			code: "SERVICE_UNAVAILABLE",
			message: "Payments are not configured",
		});
		expect(JSON.stringify(error)).not.toContain("CREEM_API_KEY");
	});

	it("maps a misconfigured provider resolution to SERVICE_UNAVAILABLE", async () => {
		vi.mocked(resolvePaymentProvider).mockImplementationOnce(() => {
			throw new WebhookConfigError(
				'[payments] provider is "custom" but paymentsConfig.customProvider is not set.',
			);
		});

		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro") },
				{ context: configErrorContext },
			),
		).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
	});

	it("rethrows unknown provider errors unchanged", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		const boom = new Error("network down");
		mockProvider.createCheckoutLink.mockRejectedValue(boom);

		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro") },
				{ context: configErrorContext },
			),
		).rejects.toBe(boom);
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
				planId: fixturePlanId<PlanId>("pro"),
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
			// Seat-based org checkout: at least the member count (1 here).
			seats: 1,
			trial: true,
			trialDays: 14,
		});
	});

	it("sanitizes external successUrl to fallback", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});

		await call(
			paymentsRouter.checkout.create,
			{
				planId: fixturePlanId<PlanId>("pro"),
				successUrl: "https://evil.com/steal",
			},
			{ context: authenticatedContext },
		);

		expect(mockProvider.createCheckoutLink).toHaveBeenCalledWith({
			priceId: "price-pro-monthly",
			userId: "user-1",
			organizationId: undefined,
			successUrl: "http://localhost:3000/",
			cancelUrl: undefined,
			customerEmail: "test@fuutu.local",
			trial: true,
			trialDays: 14,
		});
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro") },
				{
					context: unauthenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("payments.checkout.create — seats", () => {
	// Own user so these cases do not eat the shared paymentsMutation
	// rate-limit budget of `authenticatedContext`.
	const seatsContext = makeSession<Context>(makeUser({ id: "user-seats" }));

	beforeEach(() => {
		vi.clearAllMocks();
		proPlanOverrides.current = {};
		envOverrides.PAYMENTS_PRO_PRICE_ID = "price-pro-monthly";
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockResolvedValue({
			url: "https://checkout.example.com",
		});
	});

	it("forwards the seat count of a seat-based plan to the guards and the provider", async () => {
		await call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro"), seats: 5 },
			{ context: seatsContext },
		);

		expect(vi.mocked(assertCheckoutAllowed).mock.calls[0]?.[0].seats).toBe(5);
		expect(mockProvider.createCheckoutLink.mock.calls[0]?.[0].seats).toBe(5);
	});

	it("never forwards seats for a plan that is not seat-based", async () => {
		proPlanOverrides.current = { seatBased: undefined };

		await call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro"), seats: 40 },
			{ context: seatsContext },
		);

		expect(vi.mocked(assertCheckoutAllowed).mock.calls[0]?.[0].seats).toBe(1);
		// No seat count for a flat price: Stripe and Creem bill one unit,
		// Polar takes seats for seat-based pricing only.
		const input = mockProvider.createCheckoutLink.mock.calls[0]?.[0];
		expect(input).toBeDefined();
		expect(input.seats).toBeUndefined();
	});

	it("accepts up to 1000 seats", async () => {
		await call(
			paymentsRouter.checkout.create,
			{ planId: fixturePlanId<PlanId>("pro"), seats: 1000 },
			{ context: seatsContext },
		);

		expect(mockProvider.createCheckoutLink.mock.calls[0]?.[0].seats).toBe(1000);
	});

	it("bills at least the org's member count when seats follow members", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-seats", role: "owner", id: "member-s" }],
		} as never);
		vi.mocked(countOrganizationMembers).mockResolvedValue(7);

		await call(
			paymentsRouter.checkout.create,
			{
				planId: fixturePlanId<PlanId>("pro"),
				organizationId: orgFixture.id,
				seats: 2,
			},
			{ context: seatsContext },
		);

		expect(countOrganizationMembers).toHaveBeenCalledWith(orgFixture.id);
		expect(vi.mocked(assertCheckoutAllowed).mock.calls[0]?.[0].seats).toBe(7);
		expect(mockProvider.createCheckoutLink.mock.calls[0]?.[0].seats).toBe(7);
	});

	it("keeps a seat count above the member count", async () => {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-seats", role: "owner", id: "member-s" }],
		} as never);
		vi.mocked(countOrganizationMembers).mockResolvedValue(3);

		await call(
			paymentsRouter.checkout.create,
			{
				planId: fixturePlanId<PlanId>("pro"),
				organizationId: orgFixture.id,
				seats: 10,
			},
			{ context: seatsContext },
		);

		expect(mockProvider.createCheckoutLink.mock.calls[0]?.[0].seats).toBe(10);
	});

	it("rejects more than 1000 seats before any guard or provider call", async () => {
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro"), seats: 1001 },
				{ context: seatsContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(assertCheckoutAllowed).not.toHaveBeenCalled();
		expect(mockProvider.createCheckoutLink).not.toHaveBeenCalled();
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
	it("maps a provider misconfiguration to SERVICE_UNAVAILABLE", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCheckoutLink.mockRejectedValue(
			new WebhookConfigError("CREEM_API_KEY is not set"),
		);

		await expect(
			call(
				paymentsRouter.topupCheckout.create,
				{ topupId: "ai_tokens_100k" },
				{ context: configErrorContext },
			),
		).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
	});

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
		// The signed-in user checked out the org's subscription.
		vi.mocked(getPurchasesByOrganizationId).mockResolvedValue([
			{
				customerId: "cust-123",
				userId: null,
				metadata: { user_id: "user-1", organization_id: orgFixture.id },
			},
		] as never);
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

	// Own user: these cases do not eat the shared paymentsMutation budget.
	const portalContext = makeSession<Context>(makeUser({ id: "user-portal" }));
	function mockPortalMembership() {
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-portal", role: "owner", id: "member-p" }],
		} as never);
	}

	it("refuses an org admin who is not the payer: the portal is the payer's whole customer", async () => {
		mockPortalMembership();
		vi.mocked(getOrganizationById).mockResolvedValue({
			id: orgFixture.id,
			paymentsCustomerId: "cust-payer",
		} as never);
		vi.mocked(getPurchasesByOrganizationId).mockResolvedValue([
			{
				customerId: "cust-payer",
				userId: null,
				metadata: { user_id: "user-payer", organization_id: orgFixture.id },
			},
		] as never);
		vi.mocked(getUserById).mockResolvedValue({
			id: "user-payer",
			email: "jane@acme.com",
		} as never);
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);

		const error = await call(
			paymentsRouter.portal.open,
			{ organizationId: orgFixture.id },
			{ context: portalContext },
		).catch((err: unknown) => err);

		expect(error).toMatchObject({
			code: "PRECONDITION_FAILED",
			data: { reason: "portal_payer_only", payer: "j***@acme.com" },
		});
		expect(JSON.stringify(error)).not.toContain("jane@");
		expect(mockProvider.createCustomerPortalLink).not.toHaveBeenCalled();
	});

	it("lets the payer in by email when their account id changed", async () => {
		mockPortalMembership();
		vi.mocked(getOrganizationById).mockResolvedValue({
			id: orgFixture.id,
			paymentsCustomerId: "cust-payer",
		} as never);
		vi.mocked(getPurchasesByOrganizationId).mockResolvedValue([
			{
				customerId: "cust-payer",
				userId: null,
				metadata: { user_id: "user-old", organization_id: orgFixture.id },
			},
		] as never);
		vi.mocked(getUserById).mockResolvedValue({
			id: "user-old",
			email: "TEST@fuutu.local",
		} as never);
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		mockProvider.createCustomerPortalLink.mockResolvedValue({
			url: "https://portal.example.com",
		});

		await expect(
			call(
				paymentsRouter.portal.open,
				{ organizationId: orgFixture.id },
				{ context: portalContext },
			),
		).resolves.toEqual({ url: "https://portal.example.com" });
	});

	it("refuses when no purchase names the payer of the org's customer", async () => {
		mockPortalMembership();
		vi.mocked(getOrganizationById).mockResolvedValue({
			id: orgFixture.id,
			paymentsCustomerId: "cust-orphan",
		} as never);
		vi.mocked(getPurchasesByOrganizationId).mockResolvedValue([
			{
				customerId: "cust-other",
				userId: null,
				metadata: { user_id: "user-1" },
			},
		] as never);
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);

		await expect(
			call(
				paymentsRouter.portal.open,
				{ organizationId: orgFixture.id },
				{ context: portalContext },
			),
		).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			data: { reason: "portal_payer_only" },
		});
		expect(mockProvider.createCustomerPortalLink).not.toHaveBeenCalled();
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

		expect(mockProvider.cancelSubscription).toHaveBeenCalledWith("sub-1", {
			mode: "immediate",
		});
		expect(result).toEqual({ success: true, mode: "immediate" });
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

		expect(mockProvider.cancelSubscription).toHaveBeenCalledWith("sub-2", {
			mode: "immediate",
		});
		expect(result).toEqual({ success: true, mode: "immediate" });
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

describe("payments.subscription.cancel — at period end", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(isPaymentsEnabled).mockReturnValue(true);
	});

	it("passes atPeriodEnd to the provider", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-1",
			userId: "user-1",
			organizationId: null,
		} as never);
		mockProvider.cancelSubscription.mockResolvedValue(undefined);

		await call(
			paymentsRouter.subscription.cancel,
			{ subscriptionId: "sub-1", atPeriodEnd: true },
			{ context: authenticatedContext },
		);

		expect(mockProvider.cancelSubscription).toHaveBeenCalledWith("sub-1", {
			mode: "period_end",
		});
	});

	it("atPeriodEnd false cancels immediately, as without it", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-1",
			userId: "user-1",
			organizationId: null,
		} as never);
		mockProvider.cancelSubscription.mockResolvedValue(undefined);

		await call(
			paymentsRouter.subscription.cancel,
			{ subscriptionId: "sub-1", atPeriodEnd: false },
			{ context: authenticatedContext },
		);

		expect(mockProvider.cancelSubscription).toHaveBeenCalledWith("sub-1", {
			mode: "immediate",
		});
	});
});

describe("payments.subscription.resume", () => {
	// Own user: these cases do not eat the shared paymentsMutation budget.
	const resumeContext = makeSession<Context>(makeUser({ id: "user-resume" }));
	const resumeProvider = {
		...mockProvider,
		resumeSubscription: vi.fn(),
	};
	const ORG_ID = "12345678-1234-1234-8123-123456789abc";

	const resume = (subscriptionId = "sub-1", context = resumeContext) =>
		call(paymentsRouter.subscription.resume, { subscriptionId }, { context });

	const orgWith = (role: string) =>
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-resume", role, id: "member-r" }],
		} as never);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(isPaymentsEnabled).mockReturnValue(true);
		vi.mocked(resolvePaymentProvider).mockReturnValue(resumeProvider as never);
		resumeProvider.resumeSubscription.mockResolvedValue(undefined);
	});

	it("throws NOT_IMPLEMENTED when payments are disabled", async () => {
		vi.mocked(isPaymentsEnabled).mockReturnValue(false);
		await expect(resume()).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
		expect(getPurchaseByProviderSubscriptionId).not.toHaveBeenCalled();
	});

	it("resumes a subscription owned by the user", async () => {
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-r",
			userId: "user-resume",
			organizationId: null,
			status: "SCHEDULED_CANCEL",
		} as never);

		await expect(resume()).resolves.toEqual({ success: true });
		expect(getPurchaseByProviderSubscriptionId).toHaveBeenCalledWith(
			"polar",
			"sub-1",
		);
		expect(resumeProvider.resumeSubscription).toHaveBeenCalledWith("sub-1");
	});

	it("resume checks org PAYMENT.UPDATE", async () => {
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-o",
			userId: null,
			organizationId: ORG_ID,
			status: "SCHEDULED_CANCEL",
		} as never);

		orgWith("member");
		await expect(resume()).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(resumeProvider.resumeSubscription).not.toHaveBeenCalled();

		orgWith("admin");
		await expect(resume()).resolves.toEqual({ success: true });
		expect(resumeProvider.resumeSubscription).toHaveBeenCalledWith("sub-1");
	});

	it("throws FORBIDDEN for a non-member of the owning org", async () => {
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-o",
			userId: null,
			organizationId: ORG_ID,
			status: "SCHEDULED_CANCEL",
		} as never);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		await expect(resume()).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(resumeProvider.resumeSubscription).not.toHaveBeenCalled();
	});

	it("throws FORBIDDEN when the subscription belongs to another user", async () => {
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-x",
			userId: "user-2",
			organizationId: null,
			status: "SCHEDULED_CANCEL",
		} as never);
		await expect(resume()).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(resumeProvider.resumeSubscription).not.toHaveBeenCalled();
	});

	it("throws NOT_FOUND when the subscription is unknown", async () => {
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue(
			null as never,
		);
		await expect(resume("sub-missing")).rejects.toMatchObject({
			code: "NOT_FOUND",
		});
	});

	it("resume NOT_IMPLEMENTED without provider support", async () => {
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-r",
			userId: "user-resume",
			organizationId: null,
			status: "SCHEDULED_CANCEL",
		} as never);
		await expect(resume()).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });
	});

	it("maps a provider misconfiguration to SERVICE_UNAVAILABLE", async () => {
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-r",
			userId: "user-resume",
			organizationId: null,
			status: "SCHEDULED_CANCEL",
		} as never);
		resumeProvider.resumeSubscription.mockRejectedValue(
			new WebhookConfigError("CREEM_API_KEY is not set"),
		);
		await expect(resume()).rejects.toMatchObject({
			code: "SERVICE_UNAVAILABLE",
			message: "Payments are not configured",
		});
	});

	it.each(["ACTIVE", "PAUSED", "PAST_DUE", "CANCELED", "TRIALING"])(
		"refuses with PRECONDITION_FAILED when the subscription is %s, not a scheduled cancel",
		async (status) => {
			vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
				id: "purchase-r",
				userId: "user-resume",
				organizationId: null,
				status,
			} as never);
			await expect(resume()).rejects.toMatchObject({
				code: "PRECONDITION_FAILED",
			});
			expect(resumeProvider.resumeSubscription).not.toHaveBeenCalled();
		},
	);

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(resume("sub-1", unauthenticatedContext)).rejects.toMatchObject(
			{ code: "UNAUTHORIZED" },
		);
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

describe("payments — typed provider failures", () => {
	// Own user: these cases do not eat the shared paymentsMutation budget.
	const failureContext = makeSession<Context>(
		makeUser({ id: "user-provider-failure" }),
	);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(isPaymentsEnabled).mockReturnValue(true);
		vi.mocked(resolvePaymentProvider).mockReturnValue(mockProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-f",
			userId: "user-provider-failure",
			organizationId: null,
			status: "ACTIVE",
			currentPeriodEnd: null,
		} as never);
	});

	it.each([
		["not_found", "PRECONDITION_FAILED"],
		["invalid_state", "CONFLICT"],
		["rejected", "BAD_REQUEST"],
		["unavailable", "SERVICE_UNAVAILABLE"],
	] as const)(
		"a %s provider failure on cancel is %s with that reason, without the provider's detail",
		async (kind, code) => {
			mockProvider.cancelSubscription.mockRejectedValueOnce(
				Object.assign(new ProviderRequestError("Failed to cancel", kind), {
					detail: "Subscription cannot be canceled in state: canceled",
				}),
			);
			const error = await call(
				paymentsRouter.subscription.cancel,
				{ subscriptionId: "sub-f" },
				{ context: failureContext },
			).catch((err: unknown) => err);
			expect(error).toMatchObject({ code, data: { reason: kind } });
			expect(JSON.stringify(error)).not.toContain("in state");
		},
	);

	it("maps a provider failure of checkout and of the portal the same way", async () => {
		mockProvider.createCheckoutLink.mockRejectedValueOnce(
			new ProviderRequestError("Failed to create checkout link", "unavailable"),
		);
		await expect(
			call(
				paymentsRouter.checkout.create,
				{ planId: fixturePlanId<PlanId>("pro") },
				{ context: failureContext },
			),
		).rejects.toMatchObject({
			code: "SERVICE_UNAVAILABLE",
			data: { reason: "unavailable" },
		});

		vi.mocked(getActiveSubscriptionForUser).mockResolvedValueOnce({
			customerId: "cust-f",
		} as never);
		mockProvider.createCustomerPortalLink.mockRejectedValueOnce(
			new ProviderRequestError("Failed to create portal link", "not_found"),
		);
		await expect(
			call(paymentsRouter.portal.open, {}, { context: failureContext }),
		).rejects.toMatchObject({
			code: "PRECONDITION_FAILED",
			data: { reason: "not_found" },
		});
	});

	it("maps a provider failure on resume", async () => {
		const resumeProvider = {
			...mockProvider,
			resumeSubscription: vi
				.fn()
				.mockRejectedValue(
					new ProviderRequestError("Failed to resume", "invalid_state"),
				),
		};
		vi.mocked(resolvePaymentProvider).mockReturnValue(resumeProvider as never);
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-f",
			userId: "user-provider-failure",
			organizationId: null,
			status: "SCHEDULED_CANCEL",
		} as never);
		await expect(
			call(
				paymentsRouter.subscription.resume,
				{ subscriptionId: "sub-f" },
				{ context: failureContext },
			),
		).rejects.toMatchObject({
			code: "CONFLICT",
			data: { reason: "invalid_state" },
		});
	});

	it("a misconfigured provider stays SERVICE_UNAVAILABLE with the not-configured reason", async () => {
		mockProvider.cancelSubscription.mockRejectedValueOnce(
			new WebhookConfigError("Creem rejected the API key (HTTP 401)"),
		);
		const error = await call(
			paymentsRouter.subscription.cancel,
			{ subscriptionId: "sub-f" },
			{ context: failureContext },
		).catch((err: unknown) => err);
		expect(error).toMatchObject({
			code: "SERVICE_UNAVAILABLE",
			message: "Payments are not configured",
			data: { reason: "not_configured" },
		});
		expect(JSON.stringify(error)).not.toContain("API key");
	});
});

describe("payments.subscription.cancel — trials", () => {
	// Own user: these cases do not eat the shared paymentsMutation budget.
	const trialContext = makeSession<Context>(makeUser({ id: "user-trial" }));
	const DAY = 24 * 60 * 60 * 1000;
	const trialProvider = {
		...mockProvider,
		id: "creem",
		cancelEndsTrial: true,
		getSubscriptionStatus: vi.fn(),
	};
	const stored = (status: string, currentPeriodEnd: Date | null) =>
		vi.mocked(getPurchaseByProviderSubscriptionId).mockResolvedValue({
			id: "purchase-t",
			userId: "user-trial",
			organizationId: null,
			status,
			currentPeriodEnd,
		} as never);
	const cancel = (atPeriodEnd?: boolean) =>
		call(
			paymentsRouter.subscription.cancel,
			{ subscriptionId: "sub-t", atPeriodEnd },
			{ context: trialContext },
		);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(isPaymentsEnabled).mockReturnValue(true);
		vi.mocked(resolvePaymentProvider).mockReturnValue(trialProvider as never);
		trialProvider.cancelSubscription.mockResolvedValue(undefined);
	});

	it("cancels a trial now when the provider reports it trialing, and says so", async () => {
		stored("ACTIVE", new Date(Date.now() + 7 * DAY));
		trialProvider.getSubscriptionStatus.mockResolvedValueOnce("TRIALING");
		const result = await cancel(true);
		expect(trialProvider.getSubscriptionStatus).toHaveBeenCalledWith("sub-t");
		expect(trialProvider.cancelSubscription).toHaveBeenCalledWith("sub-t", {
			mode: "immediate",
		});
		expect(result).toEqual({ success: true, mode: "immediate" });
	});

	it("cancels at period end when the provider says the trial is over, though the stored row still says TRIALING", async () => {
		stored("TRIALING", new Date(Date.now() + 7 * DAY));
		trialProvider.getSubscriptionStatus.mockResolvedValueOnce("ACTIVE");
		const result = await cancel(true);
		expect(trialProvider.cancelSubscription).toHaveBeenCalledWith("sub-t", {
			mode: "period_end",
		});
		expect(result).toEqual({ success: true, mode: "period_end" });
	});

	it("a failed status lookup falls back to a stored trial that has not ended", async () => {
		stored("TRIALING", new Date(Date.now() + DAY));
		trialProvider.getSubscriptionStatus.mockRejectedValueOnce(
			new Error("down"),
		);
		await cancel(true);
		expect(trialProvider.cancelSubscription).toHaveBeenCalledWith("sub-t", {
			mode: "immediate",
		});
	});

	it.each([
		["a stored trial whose period ended", "TRIALING", -1],
		["a stored trial without a period end", "TRIALING", null],
		["an active subscription", "ACTIVE", 7],
	] as const)(
		"a failed status lookup cancels at period end for %s",
		async (_, status, days) => {
			stored(status, days === null ? null : new Date(Date.now() + days * DAY));
			trialProvider.getSubscriptionStatus.mockRejectedValueOnce(
				new Error("down"),
			);
			await cancel(true);
			expect(trialProvider.cancelSubscription).toHaveBeenCalledWith("sub-t", {
				mode: "period_end",
			});
		},
	);

	it("a provider that keeps trials until their end is not asked and cancels at period end", async () => {
		const keepsTrial = { ...trialProvider, cancelEndsTrial: false };
		vi.mocked(resolvePaymentProvider).mockReturnValue(keepsTrial as never);
		stored("TRIALING", new Date(Date.now() + DAY));
		await cancel(true);
		expect(keepsTrial.getSubscriptionStatus).not.toHaveBeenCalled();
		expect(keepsTrial.cancelSubscription).toHaveBeenCalledWith("sub-t", {
			mode: "period_end",
		});
	});

	it("an immediate cancel needs no trial lookup", async () => {
		stored("TRIALING", new Date(Date.now() + DAY));
		const result = await cancel();
		expect(trialProvider.getSubscriptionStatus).not.toHaveBeenCalled();
		expect(result).toEqual({ success: true, mode: "immediate" });
	});
});
