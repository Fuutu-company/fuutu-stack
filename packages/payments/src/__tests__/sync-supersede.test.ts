import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider, ProviderEvent } from "../types";

// Kit catalog fixture plus one add-on plan (`proSeats`, a seat pack that
// stacks on `pro`) — the kit catalog ships none to exercise.
vi.mock("../config", async (importOriginal) => {
	const actual = {
		...(await importOriginal<typeof import("../config")>()),
		...(await import("@fuutu/test-utils")).planCatalogFixture,
	};
	const PLANS = {
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
			priceIdEnvVars: { month: "PAYMENTS_PRO_SEATS_PRICE_ID" },
		},
		// One-time add-on (e.g. a lifetime boost on top of pro).
		proBoost: {
			amount: 900,
			currency: "usd",
			billingType: "one_time",
			addonOf: "pro",
			displayPrice: "$9",
			showInSaas: true,
			showInMarketing: false,
			priceIdEnvVars: { month: "PAYMENTS_PRO_BOOST_PRICE_ID" },
		},
		// One-time base plan (lifetime access).
		lifetime: {
			tier: "pro",
			amount: 29900,
			currency: "usd",
			billingType: "one_time",
			displayPrice: "$299",
			showInSaas: true,
			showInMarketing: true,
			priceIdEnvVars: { month: "PAYMENTS_LIFETIME_PRICE_ID" },
		},
	};
	return {
		...actual,
		PLANS,
		PLAN_IDS: Object.keys(PLANS),
		CREDITS: {
			...actual.CREDITS,
			proSeats: {},
			proBoost: {},
			lifetime: actual.CREDITS.pro,
		},
	};
});

vi.mock("@fuutu/env/saas", () => ({
	env: {
		NODE_ENV: "test",
		PAYMENTS_PRO_PRICE_ID: "price_pro",
		PAYMENTS_PRO_SEATS_PRICE_ID: "price_pro_seats",
		PAYMENTS_PRO_BOOST_PRICE_ID: "price_pro_boost",
		PAYMENTS_LIFETIME_PRICE_ID: "price_lifetime",
	},
}));

const mockCreatePurchase = vi.fn();
const mockUpdatePurchase = vi.fn();
const mockGetPurchasesByOrganizationId = vi.fn();
const mockGetActiveSubscriptionForOrganization = vi.fn();
const mockGetActiveSubscriptionsForOwner = vi.fn();
const mockGetActiveOneTimePlanPurchase = vi.fn();

vi.mock("@fuutu/db", () => ({
	createPurchase: mockCreatePurchase,
	updatePurchase: mockUpdatePurchase,
	getPurchaseByProviderSubscriptionId: vi.fn().mockResolvedValue(null),
	getPurchaseByCheckoutEventId: vi.fn(),
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
	getPurchasesByUserId: vi.fn().mockResolvedValue([]),
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionForOrganization:
		mockGetActiveSubscriptionForOrganization,
	getActiveSubscriptionsForOwner: mockGetActiveSubscriptionsForOwner,
	getActiveOneTimePlanPurchase: mockGetActiveOneTimePlanPurchase,
	getCreditBalance: vi.fn().mockResolvedValue(null),
	setPaymentsCustomerId: vi.fn(),
	setOrganizationPaymentsCustomerId: vi.fn(),
	upsertInvoiceByProviderId: vi.fn(),
	isUniqueViolation: () => false,
}));

vi.mock("@fuutu/credits", () => ({
	grantRecurringCredits: vi.fn(),
	grantTopUpCredits: vi.fn(),
	resetRecurringCredits: vi.fn(),
}));

const mockLogError = vi.hoisted(() => vi.fn());
vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: mockLogError,
		debug: vi.fn(),
	}),
}));

vi.mock("@fuutu/webhooks", () => ({ dispatchEvent: vi.fn() }));

const provider = vi.hoisted(() => ({
	current: null as PaymentProvider | null,
}));

vi.mock("../resolve", () => ({
	resolvePaymentProvider: () => provider.current,
	resolvePaymentProviderById: (id: string) =>
		provider.current?.id === id ? provider.current : null,
}));

const { processWebhookEvents, getActivePlanId } = await import("../sync");
const { resolveActivePlan } = await import("../plan-resolver");
const { getOneTimePlanPriceIds } = await import("../config.server");
const { registerSupersedePolicy } = await import("../extensions");

const ORG = "org_1";

const activation = (
	subscriptionId: string,
	productId: string,
): ProviderEvent => ({
	type: "subscription.activated",
	subscriptionId,
	productId,
	status: "ACTIVE",
	metadata: { organization_id: ORG },
});

const stored = (subscriptionId: string, productId: string) => ({
	id: `purchase_${subscriptionId}`,
	type: "SUBSCRIPTION",
	provider: "creem",
	subscriptionId,
	productId,
	priceId: productId,
	organizationId: ORG,
	userId: null,
	status: "ACTIVE",
});

const canceledIds = () =>
	mockUpdatePurchase.mock.calls
		.map(([input]) => input as { id: string; status?: string })
		.filter((input) => input.status === "CANCELED")
		.map((input) => input.id);

beforeEach(() => {
	vi.clearAllMocks();
	mockGetActiveOneTimePlanPurchase.mockResolvedValue(null);
	provider.current = {
		id: "creem",
		createCheckoutLink: vi.fn(),
		createCustomerPortalLink: vi.fn(),
		createCustomer: vi.fn(),
		cancelSubscription: vi.fn().mockResolvedValue(undefined),
		parseWebhook: vi.fn(),
	};
});

afterEach(() => {
	registerSupersedePolicy(null);
});

describe("activation supersedes other subscriptions (default policy)", () => {
	it("keeps the base subscription ACTIVE when an add-on activates", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			stored("sub_base", "price_pro"),
		]);

		await processWebhookEvents("creem", [
			activation("sub_addon", "price_pro_seats"),
		]);

		expect(provider.current?.cancelSubscription).not.toHaveBeenCalled();
		expect(canceledIds()).toEqual([]);
		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({
				subscriptionId: "sub_addon",
				productId: "price_pro_seats",
			}),
		);
	});

	it("keeps add-ons when a base plan activates, but still replaces the old base", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			stored("sub_addon", "price_pro_seats"),
			stored("sub_old_base", "price_pro"),
		]);

		await processWebhookEvents("creem", [
			activation("sub_new_base", "price_pro"),
		]);

		expect(provider.current?.cancelSubscription).toHaveBeenCalledTimes(1);
		expect(provider.current?.cancelSubscription).toHaveBeenCalledWith(
			"sub_old_base",
			{ mode: "immediate" },
		);
		expect(canceledIds()).toEqual(["purchase_sub_old_base"]);
	});

	it("replaces subscriptions of unknown products as before", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			stored("sub_old", "prod_unmapped"),
		]);

		await processWebhookEvents("creem", [activation("sub_new", "price_pro")]);

		expect(provider.current?.cancelSubscription).toHaveBeenCalledWith(
			"sub_old",
			{ mode: "immediate" },
		);
		expect(canceledIds()).toEqual(["purchase_sub_old"]);
	});
});

describe("registerSupersedePolicy", () => {
	it("decides per existing subscription with resolved plan ids", async () => {
		const policy = vi.fn(() => false);
		registerSupersedePolicy(policy);
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			stored("sub_old", "price_pro"),
		]);

		await processWebhookEvents("creem", [activation("sub_new", "prod_other")]);

		expect(policy).toHaveBeenCalledTimes(1);
		expect(policy).toHaveBeenCalledWith(
			{
				planId: null,
				productId: "prod_other",
				subscriptionId: "sub_new",
				owner: { organizationId: ORG },
			},
			{
				planId: "pro",
				productId: "price_pro",
				subscriptionId: "sub_old",
				purchaseId: "purchase_sub_old",
				status: "ACTIVE",
			},
			expect.any(Function),
		);
		expect(provider.current?.cancelSubscription).not.toHaveBeenCalled();
		expect(canceledIds()).toEqual([]);
	});

	it("can build on the kit default", async () => {
		registerSupersedePolicy((_activated, _existing, defaults) => defaults());
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			stored("sub_addon", "price_pro_seats"),
			stored("sub_old", "price_pro"),
		]);

		await processWebhookEvents("creem", [activation("sub_new", "price_pro")]);

		expect(canceledIds()).toEqual(["purchase_sub_old"]);
	});

	it("an async policy that keeps nothing cancels everything else", async () => {
		registerSupersedePolicy(async () => true);
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			stored("sub_base", "price_pro"),
		]);

		await processWebhookEvents("creem", [
			activation("sub_addon", "price_pro_seats"),
		]);

		expect(canceledIds()).toEqual(["purchase_sub_base"]);
	});
});

describe("provider cancel failure", () => {
	const withStatusLookup = (lookup: () => Promise<string>) => {
		const current = provider.current;
		if (!current) throw new Error("no provider");
		vi.mocked(current.cancelSubscription).mockRejectedValue(
			new Error("creem 400"),
		);
		provider.current = {
			...current,
			getSubscriptionStatus: vi.fn(lookup),
		} as PaymentProvider;
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			stored("sub_old", "price_pro"),
		]);
	};

	it.each(["CANCELED", "EXPIRED"])(
		"marks the row CANCELED when the provider reports it %s (already canceled)",
		async (status) => {
			withStatusLookup(async () => status);

			await processWebhookEvents("creem", [activation("sub_new", "price_pro")]);

			expect(provider.current?.getSubscriptionStatus).toHaveBeenCalledWith(
				"sub_old",
			);
			expect(canceledIds()).toEqual(["purchase_sub_old"]);
		},
	);

	it("keeps the row ACTIVE when the provider still reports it active", async () => {
		withStatusLookup(async () => "ACTIVE");

		await processWebhookEvents("creem", [activation("sub_new", "price_pro")]);

		expect(canceledIds()).toEqual([]);
	});

	it("keeps the row ACTIVE when the status lookup fails too (transient)", async () => {
		withStatusLookup(async () => {
			throw new Error("network down");
		});

		await expect(
			processWebhookEvents("creem", [activation("sub_new", "price_pro")]),
		).resolves.toBeUndefined();

		expect(canceledIds()).toEqual([]);
		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({ subscriptionId: "sub_new" }),
		);
	});

	it("leaves the old subscription ACTIVE in the DB and still records the new one", async () => {
		vi.mocked(
			provider.current?.cancelSubscription ?? vi.fn(),
		).mockRejectedValue(new Error("creem 503"));
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			stored("sub_old", "price_pro"),
		]);

		await expect(
			processWebhookEvents("creem", [activation("sub_new", "price_pro")]),
		).resolves.toBeUndefined();

		expect(canceledIds()).toEqual([]);
		expect(mockCreatePurchase).toHaveBeenCalledWith(
			expect.objectContaining({ subscriptionId: "sub_new" }),
		);
		expect(mockLogError).toHaveBeenCalledWith(
			expect.stringContaining("left ACTIVE"),
			expect.objectContaining({ oldSubscriptionId: "sub_old" }),
		);
	});
});

describe("plan resolution with a stacked add-on", () => {
	it("resolves the base plan even when the add-on is the newest active subscription", async () => {
		const addon = stored("sub_addon", "price_pro_seats");
		const base = stored("sub_base", "price_pro");
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(addon);
		mockGetActiveSubscriptionsForOwner.mockResolvedValue([addon, base]);

		expect(await getActivePlanId(null, ORG)).toBe("price_pro");
		expect(await resolveActivePlan(null, ORG)).toMatchObject({
			planId: "pro",
		});
		expect(mockGetActiveSubscriptionsForOwner).toHaveBeenCalledWith({
			organizationId: ORG,
		});
	});

	it("an add-on without its base grants no plan", async () => {
		const addon = stored("sub_addon", "price_pro_seats");
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(addon);
		mockGetActiveSubscriptionsForOwner.mockResolvedValue([addon]);

		expect(await getActivePlanId(null, ORG)).toBeNull();
		expect(await resolveActivePlan(null, ORG)).toMatchObject({
			planId: "free",
		});
	});

	it("a one-time add-on is no lifetime plan once its base is gone", async () => {
		// Base canceled: no access-gating subscription left.
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(null);
		mockGetActiveOneTimePlanPurchase.mockImplementation(
			async (_owner: unknown, productIds: string[]) =>
				productIds.includes("price_pro_boost")
					? { ...stored("boost", "price_pro_boost"), type: "ONE_TIME" }
					: null,
		);

		expect(await getActivePlanId(null, ORG)).toBeNull();
		expect(await resolveActivePlan(null, ORG)).toMatchObject({
			planId: "free",
		});
	});

	it("one-time plan price ids skip add-ons", () => {
		expect(getOneTimePlanPriceIds()).toEqual(["price_lifetime"]);
	});

	it("does not look further when the newest subscription is a plan", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(
			stored("sub_base", "price_pro"),
		);

		expect(await getActivePlanId(null, ORG)).toBe("price_pro");
		expect(mockGetActiveSubscriptionsForOwner).not.toHaveBeenCalled();
	});
});
