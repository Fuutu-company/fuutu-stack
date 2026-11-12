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
const { registerEntitlementResolver } = await import("../extensions");
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

describe("Entitlement.seatsTotal", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("is the plan's numeric membersPerOrg cap", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(PRO_PURCHASE);
		expect((await getOrgEntitlement("org_1")).seatsTotal).toBe(50);
	});

	it("is the free plan's cap when the org has no purchase", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(null);
		expect((await getOrgEntitlement("org_1")).seatsTotal).toBe(5);
	});

	it("is set on user-scoped entitlements too", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(null);
		expect((await getUserEntitlement("user_1")).seatsTotal).toBe(5);
	});
});

describe("registerEntitlementResolver", () => {
	const custom = {
		scope: "organization" as const,
		ownerId: "org_1",
		planId: "free" as const,
		tier: "free" as const,
		features: ["custom_feature"],
		limits: LIMITS.free,
		seatsTotal: 12,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		registerEntitlementResolver(null);
	});

	it("replaces the default org computation when an org resolver is registered", async () => {
		const org = vi.fn().mockResolvedValue(custom);
		registerEntitlementResolver({ org });

		const entitlement = await getOrgEntitlement("org_1");

		expect(entitlement.seatsTotal).toBe(12);
		expect(org).toHaveBeenCalledWith("org_1", expect.any(Function));
		expect(mockGetActiveSubscriptionForOrganization).not.toHaveBeenCalled();
	});

	it("hands the resolver the default computation to build on", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(PRO_PURCHASE);
		registerEntitlementResolver({
			org: async (_id, defaults) => ({
				...(await defaults()),
				seatsTotal: 99,
			}),
		});

		const entitlement = await getOrgEntitlement("org_1");

		expect(entitlement).toMatchObject({ planId: "pro", seatsTotal: 99 });
	});

	it("routes hasFeature and the active-org user path through the org resolver", async () => {
		registerEntitlementResolver({ org: async () => custom });

		await expect(
			hasFeature({ organizationId: "org_1" }, "custom_feature"),
		).resolves.toBe(true);
		await expect(
			getUserEntitlement("user_1", { activeOrganizationId: "org_1" }),
		).resolves.toMatchObject({ seatsTotal: 12 });
	});

	it("replaces the personal computation when a user resolver is registered", async () => {
		const user = vi.fn().mockResolvedValue({
			...custom,
			scope: "user",
			ownerId: "user_1",
		});
		registerEntitlementResolver({ user });

		await expect(getUserEntitlement("user_1")).resolves.toMatchObject({
			scope: "user",
			features: ["custom_feature"],
		});
		expect(user).toHaveBeenCalledWith("user_1", expect.any(Function));
		expect(mockGetActiveSubscriptionForUser).not.toHaveBeenCalled();
	});

	it("keeps the default for the scope a resolver does not cover", async () => {
		mockGetActiveSubscriptionForUser.mockResolvedValue(null);
		registerEntitlementResolver({ org: async () => custom });

		await expect(getUserEntitlement("user_1")).resolves.toMatchObject({
			scope: "user",
			planId: "free",
		});
	});

	it("restores the default computation when unregistered", async () => {
		mockGetActiveSubscriptionForOrganization.mockResolvedValue(null);
		registerEntitlementResolver({ org: async () => custom });
		registerEntitlementResolver(null);

		await expect(getOrgEntitlement("org_1")).resolves.toMatchObject({
			features: expect.not.arrayContaining(["custom_feature"]),
			seatsTotal: 5,
		});
	});
});
