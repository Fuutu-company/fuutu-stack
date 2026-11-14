import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Kit catalog fixture plus an add-on plan (`proSeats` stacks on `pro`).
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
	};
	return { ...actual, PLANS, PLAN_IDS: Object.keys(PLANS) };
});

vi.mock("@fuutu/env/saas", () => ({
	env: {
		NODE_ENV: "test",
		PAYMENTS_PRO_PRICE_ID: "price_pro",
		PAYMENTS_PRO_SEATS_PRICE_ID: "price_pro_seats",
	},
}));

const mockGetPurchasesByOrganizationId = vi.fn();
const mockGetPurchasesByUserId = vi.fn();
vi.mock("@fuutu/db", () => ({
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
	getPurchasesByUserId: mockGetPurchasesByUserId,
	getActiveSubscriptionForOrganization: vi.fn(),
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionsForOwner: vi.fn(),
}));

const { assertCheckoutAllowed, ADDON_REQUIRES_BASE } = await import(
	"../billing-policy"
);
const { registerCheckoutGuard } = await import("../extensions");
const { CheckoutRejectedError } = await import("../types");

const DAY = 24 * 60 * 60 * 1000;

const purchase = (
	productId: string,
	status: string,
	currentPeriodEnd: Date | null = null,
) => ({
	id: `purchase_${productId}_${status}`,
	type: "SUBSCRIPTION",
	provider: "creem",
	subscriptionId: `sub_${productId}`,
	productId,
	priceId: productId,
	organizationId: "org_1",
	userId: null,
	status,
	currentPeriodEnd,
});

const orgCheckout = (planId: string) => ({
	owner: { organizationId: "org_1" },
	userId: "user_1",
	// The add-on plan only exists in this test's catalog.
	planId: planId as "pro",
	interval: "month" as const,
});

const unsubscribe: (() => void)[] = [];

beforeEach(() => {
	vi.clearAllMocks();
	mockGetPurchasesByOrganizationId.mockResolvedValue([]);
	mockGetPurchasesByUserId.mockResolvedValue([]);
});

afterEach(() => {
	for (const fn of unsubscribe.splice(0)) fn();
});

describe("assertCheckoutAllowed — add-on needs its base", () => {
	it("rejects an add-on checkout without an active base plan", async () => {
		const result = assertCheckoutAllowed(orgCheckout("proSeats"));
		await expect(result).rejects.toBeInstanceOf(CheckoutRejectedError);
		await expect(result).rejects.toMatchObject({
			reason: ADDON_REQUIRES_BASE,
		});
		expect(ADDON_REQUIRES_BASE).toBe("addon_requires_base");
	});

	it("rejects an add-on when the base is canceled or its scheduled cancel ran out", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "CANCELED"),
			purchase("price_pro", "SCHEDULED_CANCEL", new Date(Date.now() - DAY)),
		]);
		await expect(
			assertCheckoutAllowed(orgCheckout("proSeats")),
		).rejects.toMatchObject({ reason: "addon_requires_base" });
	});

	it.each([
		["ACTIVE", null],
		["TRIALING", null],
		["SCHEDULED_CANCEL", new Date(Date.now() + DAY)],
	])("allows an add-on on a %s base", async (status, periodEnd) => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", status, periodEnd),
		]);
		await expect(
			assertCheckoutAllowed(orgCheckout("proSeats")),
		).resolves.toBeUndefined();
	});

	it("loads the purchases of a personal owner", async () => {
		await assertCheckoutAllowed({
			...orgCheckout("pro"),
			owner: { userId: "user_1" },
		});
		expect(mockGetPurchasesByUserId).toHaveBeenCalledWith("user_1");
		expect(mockGetPurchasesByOrganizationId).not.toHaveBeenCalled();
	});

	it("allows a plain plan checkout without guards", async () => {
		await expect(
			assertCheckoutAllowed(orgCheckout("pro")),
		).resolves.toBeUndefined();
	});
});

describe("registerCheckoutGuard", () => {
	it("passes the request and the owner's purchases with resolved plans", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "ACTIVE"),
			purchase("prod_topup", "ACTIVE"),
		]);
		const guard = vi.fn();
		unsubscribe.push(registerCheckoutGuard(guard));

		await assertCheckoutAllowed({ ...orgCheckout("pro"), seats: 3 });

		expect(guard).toHaveBeenCalledWith({
			owner: { organizationId: "org_1" },
			userId: "user_1",
			planId: "pro",
			interval: "month",
			seats: 3,
			existingPurchases: [
				expect.objectContaining({
					subscriptionId: "sub_price_pro",
					planId: "pro",
					grantsAccess: true,
				}),
				expect.objectContaining({ planId: null, grantsAccess: true }),
			],
		});
	});

	it("propagates a guard's rejection", async () => {
		unsubscribe.push(
			registerCheckoutGuard(({ owner }) => {
				if (!("organizationId" in owner)) {
					throw new CheckoutRejectedError("organization_required");
				}
			}),
		);

		await expect(
			assertCheckoutAllowed({
				...orgCheckout("pro"),
				owner: { userId: "user_1" },
			}),
		).rejects.toMatchObject({ reason: "organization_required" });
		await expect(
			assertCheckoutAllowed(orgCheckout("pro")),
		).resolves.toBeUndefined();
	});

	it("runs the kit add-on rule before app guards, and guards in order", async () => {
		const calls: string[] = [];
		unsubscribe.push(
			registerCheckoutGuard(() => {
				calls.push("first");
			}),
			registerCheckoutGuard(async () => {
				calls.push("second");
			}),
		);

		await assertCheckoutAllowed(orgCheckout("pro"));
		expect(calls).toEqual(["first", "second"]);

		calls.length = 0;
		await expect(
			assertCheckoutAllowed(orgCheckout("proSeats")),
		).rejects.toMatchObject({ reason: "addon_requires_base" });
		expect(calls).toEqual([]);
	});

	it("stops running a guard after unsubscribe", async () => {
		const guard = vi.fn();
		const off = registerCheckoutGuard(guard);
		off();
		await assertCheckoutAllowed(orgCheckout("pro"));
		expect(guard).not.toHaveBeenCalled();
	});
});
