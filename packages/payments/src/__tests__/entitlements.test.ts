import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock @fuutu/db — entitlement resolution reads purchases, nothing else.
// The stub surface must cover every named import in ../sync (transitively
// pulled in via ../plan-resolver), same as sync.test.ts.
const mockGetActiveSubscriptionForUser = vi.fn();
const mockGetActiveSubscriptionForOrganization = vi.fn();

vi.mock("@fuutu/db", () => ({
	createPurchase: vi.fn(),
	updatePurchase: vi.fn(),
	getPurchaseByProviderSubscriptionId: vi.fn(),
	getCreditBalance: vi.fn(),
	getPurchaseByCheckoutEventId: vi.fn(),
	getPurchasesByOrganizationId: vi.fn(),
	getPurchasesByUserId: vi.fn(),
	getActiveSubscriptionForUser: mockGetActiveSubscriptionForUser,
	getActiveSubscriptionForOrganization:
		mockGetActiveSubscriptionForOrganization,
	setPaymentsCustomerId: vi.fn(),
	setOrganizationPaymentsCustomerId: vi.fn(),
	upsertInvoiceByProviderId: vi.fn(),
	isUniqueViolation: (err: unknown) =>
		err instanceof Error && "code" in err && err.code === "P2002",
}));

vi.mock("@fuutu/credits", () => ({
	grantRecurringCredits: vi.fn(),
	grantTopUpCredits: vi.fn(),
	resetRecurringCredits: vi.fn(),
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	}),
}));

// product → plan mapping is env-backed (config.server.ts) — stub the price
// IDs the same way sync.test.ts does so "test-pro-price" resolves to "pro".
vi.mock("@fuutu/env/saas", () => ({
	env: {
		PAYMENTS_PROVIDER: "polar",
		PAYMENTS_PRO_PRICE_ID: "test-pro-price",
		PAYMENTS_PRO_YEARLY_PRICE_ID: "test-pro-yearly",
		NODE_ENV: "test",
	},
}));

const { getOrgEntitlement, getUserEntitlement, hasFeature } = await import(
	"../entitlements"
);
const { LIMITS } = await import("../config");

const PRO_PURCHASE = {
	id: "purchase_1",
	productId: "test-pro-price",
	priceId: "test-pro-price",
};

describe("getOrgEntitlement", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("resolves the org's active purchase to plan, tier, features and limits", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(PRO_PURCHASE);

		const entitlement = await getOrgEntitlement("org_1");

		expect(entitlement.scope).toBe("organization");
		expect(entitlement.ownerId).toBe("org_1");
		expect(entitlement.planId).toBe("pro");
		expect(entitlement.tier).toBe("pro");
		expect(entitlement.features).toContain("auth_passkeys");
		expect(entitlement.limits).toEqual(LIMITS.pro);
		expect(mockGetActiveSubscriptionForOrganization).toHaveBeenCalledWith(
			"org_1",
		);
		expect(mockGetActiveSubscriptionForUser).not.toHaveBeenCalled();
	});

	it("falls back to the free plan when the org has no active purchase", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(null);

		const entitlement = await getOrgEntitlement("org_free");

		expect(entitlement.scope).toBe("organization");
		expect(entitlement.planId).toBe("free");
		expect(entitlement.tier).toBe("free");
		expect(entitlement.features).toContain("api_keys");
		expect(entitlement.features).not.toContain("auth_passkeys");
		expect(entitlement.limits).toEqual(LIMITS.free);
	});
});

describe("getUserEntitlement", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("resolves the user's own active purchase to a personal entitlement", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(PRO_PURCHASE);

		const entitlement = await getUserEntitlement("user_1");

		expect(entitlement.scope).toBe("user");
		expect(entitlement.ownerId).toBe("user_1");
		expect(entitlement.planId).toBe("pro");
		expect(entitlement.tier).toBe("pro");
		expect(mockGetActiveSubscriptionForUser).toHaveBeenCalledWith("user_1");
		expect(mockGetActiveSubscriptionForOrganization).not.toHaveBeenCalled();
	});

	it("lets the active organization's entitlement win over a personal purchase", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(PRO_PURCHASE);
		mockGetActiveSubscriptionForOrganization.mockResolvedValue({
			...PRO_PURCHASE,
			id: "purchase_org",
		});

		const entitlement = await getUserEntitlement("user_1", {
			activeOrganizationId: "org_9",
		});

		expect(entitlement.scope).toBe("organization");
		expect(entitlement.ownerId).toBe("org_9");
		expect(entitlement.planId).toBe("pro");
		expect(mockGetActiveSubscriptionForUser).not.toHaveBeenCalled();
	});

	it("resolves the org entitlement even when the org has no active purchase", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(PRO_PURCHASE);
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(null);

		const entitlement = await getUserEntitlement("user_1", {
			activeOrganizationId: "org_free",
		});

		expect(entitlement.scope).toBe("organization");
		expect(entitlement.planId).toBe("free");
	});

	it("falls back to the free plan when the user has no active purchase", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(null);

		const entitlement = await getUserEntitlement("user_free");

		expect(entitlement.scope).toBe("user");
		expect(entitlement.ownerId).toBe("user_free");
		expect(entitlement.planId).toBe("free");
		expect(entitlement.tier).toBe("free");
	});
});

describe("hasFeature", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns true for a feature included in the owner's tier", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(PRO_PURCHASE);

		await expect(
			hasFeature({ userId: "user_1" }, "auth_passkeys"),
		).resolves.toBe(true);
	});

	it("returns false for a feature gated on a higher tier", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(PRO_PURCHASE);

		await expect(hasFeature({ userId: "user_1" }, "auth_sso")).resolves.toBe(
			false,
		);
	});

	it("returns false on the free plan", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(null);

		await expect(
			hasFeature({ userId: "user_free" }, "auth_passkeys"),
		).resolves.toBe(false);
	});

	it("lets the organization win when both ids are given", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(PRO_PURCHASE);
		mockGetActiveSubscriptionForUser.mockResolvedValue(null);

		await expect(
			hasFeature(
				{ userId: "user_free", organizationId: "org_1" },
				"auth_passkeys",
			),
		).resolves.toBe(true);
		expect(mockGetActiveSubscriptionForUser).not.toHaveBeenCalled();
	});

	it("returns false when no owner is given", async () => {
		await expect(hasFeature({}, "api_keys")).resolves.toBe(false);
	});
});
