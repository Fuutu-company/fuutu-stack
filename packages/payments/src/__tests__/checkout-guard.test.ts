import type { FixturePlanId } from "@fuutu/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanId } from "../config";

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
		// One trial per owner.
		team: {
			amount: 900,
			currency: "usd",
			billingType: "subscription",
			interval: "month",
			trialDays: 14,
			trialOnce: true,
			displayPrice: "$9",
			showInSaas: true,
			showInMarketing: true,
			priceIdEnvVars: { month: "PAYMENTS_TEAM_PRICE_ID" },
			noTrialPriceIdEnvVars: { month: "PAYMENTS_TEAM_NOTRIAL_PRICE_ID" },
		},
		// Opted out of the once-only default: a trial on every checkout.
		trialEvery: {
			amount: 900,
			currency: "usd",
			billingType: "subscription",
			interval: "month",
			trialDays: 7,
			trialOnce: false,
			displayPrice: "$9",
			showInSaas: true,
			showInMarketing: true,
			priceIdEnvVars: { month: "PAYMENTS_TRIAL_EVERY_PRICE_ID" },
		},
	};
	return { ...actual, PLANS, PLAN_IDS: Object.keys(PLANS) };
});

vi.mock("@fuutu/env/saas", () => ({
	env: {
		NODE_ENV: "test",
		PAYMENTS_PRO_PRICE_ID: "price_pro",
		PAYMENTS_PRO_SEATS_PRICE_ID: "price_pro_seats",
		PAYMENTS_TEAM_PRICE_ID: "price_team",
		PAYMENTS_TEAM_NOTRIAL_PRICE_ID: "price_team_notrial",
		PAYMENTS_PRO_YEARLY_PRICE_ID: "price_pro_yearly",
		PAYMENTS_TRIAL_EVERY_PRICE_ID: "price_trial_every",
	},
}));

const mockGetPurchasesByOrganizationId = vi.fn();
const mockGetPurchasesByUserId = vi.fn();
const mockGetPurchasesCheckedOutByUser = vi.fn();
vi.mock("@fuutu/db", () => ({
	getPurchasesByOrganizationId: mockGetPurchasesByOrganizationId,
	getPurchasesByUserId: mockGetPurchasesByUserId,
	getPurchasesCheckedOutByUser: mockGetPurchasesCheckedOutByUser,
	getActiveSubscriptionForOrganization: vi.fn(),
	getActiveSubscriptionForUser: vi.fn(),
	getActiveSubscriptionsForOwner: vi.fn(),
}));

const {
	assertCheckoutAllowed,
	ADDON_REQUIRES_BASE,
	ALREADY_SUBSCRIBED,
	RESUME_INSTEAD,
} = await import("../billing-policy");
const { registerCheckoutGuard, registerTrialEligibilityPolicy } = await import(
	"../extensions"
);
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

const orgCheckout = (
	planId: FixturePlanId | "proSeats" | "team" | "trialEvery",
) => ({
	owner: { organizationId: "org_1" },
	userId: "user_1",
	// Ids of this test's catalog (fixture + `proSeats`), not the app's —
	// typed as the app's PlanId so the suite compiles under any catalog.
	planId: planId as string as PlanId,
	interval: "month" as const,
});

const unsubscribe: (() => void)[] = [];

beforeEach(() => {
	vi.clearAllMocks();
	mockGetPurchasesByOrganizationId.mockResolvedValue([]);
	mockGetPurchasesByUserId.mockResolvedValue([]);
	mockGetPurchasesCheckedOutByUser.mockResolvedValue([]);
});

afterEach(() => {
	for (const fn of unsubscribe.splice(0)) fn();
	registerTrialEligibilityPolicy(null);
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
		).resolves.toEqual({ trial: false });
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
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: true,
		});
	});
});

describe("assertCheckoutAllowed — no second paid subscription of the same plan", () => {
	it("rejects a checkout of the plan the owner actively pays for", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "ACTIVE"),
		]);
		const result = assertCheckoutAllowed(orgCheckout("pro"));
		await expect(result).rejects.toBeInstanceOf(CheckoutRejectedError);
		await expect(result).rejects.toMatchObject({
			reason: ALREADY_SUBSCRIBED,
		});
		expect(ALREADY_SUBSCRIBED).toBe("already_subscribed");
	});

	it("tells the owner to resume a subscription set to cancel at period end", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "SCHEDULED_CANCEL", new Date(Date.now() + DAY)),
		]);
		const result = assertCheckoutAllowed(orgCheckout("pro"));
		await expect(result).rejects.toBeInstanceOf(CheckoutRejectedError);
		await expect(result).rejects.toMatchObject({ reason: RESUME_INSTEAD });
		expect(RESUME_INSTEAD).toBe("resume_instead");
	});

	it("allows the other billing interval of the plan (switch to yearly)", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro_yearly", "ACTIVE"),
		]);
		await expect(
			assertCheckoutAllowed(orgCheckout("pro")),
		).resolves.toMatchObject({ trial: false });
	});

	it("allows buying the plan during its unpaid trial (convert now)", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "TRIALING"),
		]);
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: false,
		});
	});

	it("allows the plan again once the old subscription ended", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "SCHEDULED_CANCEL", new Date(Date.now() - DAY)),
		]);
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: false,
		});
	});
});

describe("registerCheckoutGuard", () => {
	it("passes the request and the owner's purchases with resolved plans", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_team", "ACTIVE"),
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
			trial: true,
			skipTrial: false,
			existingPurchases: [
				expect.objectContaining({
					subscriptionId: "sub_price_team",
					planId: "team",
					grantsAccess: true,
				}),
				expect.objectContaining({ planId: null, grantsAccess: true }),
			],
			checkoutUserPurchases: [],
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
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: true,
		});
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

describe("assertCheckoutAllowed — trial decision", () => {
	// Secure default: trialOnce unset means once. Was "a trial on every
	// checkout" — cancel and re-checkout handed out unlimited trials.
	it("a plan without trialOnce grants its trial once per owner", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "CANCELED"),
		]);
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: false,
		});
	});

	it("trialOnce: false grants the trial on every checkout", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_trial_every", "CANCELED"),
		]);
		await expect(
			assertCheckoutAllowed(orgCheckout("trialEvery")),
		).resolves.toEqual({ trial: true });
	});

	it("no second trial for the same user in another organization", async () => {
		mockGetPurchasesCheckedOutByUser.mockResolvedValue([
			{
				...purchase("price_pro", "CANCELED"),
				organizationId: "org_2",
				metadata: { user_id: "user_1", organization_id: "org_2" },
			},
		]);
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: false,
		});
		expect(mockGetPurchasesCheckedOutByUser).toHaveBeenCalledWith("user_1");
	});

	it("another user's earlier trial in another org does not count", async () => {
		mockGetPurchasesCheckedOutByUser.mockResolvedValue([]);
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: true,
		});
	});

	it("a plan without trialDays has trial false", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "ACTIVE"),
		]);
		await expect(
			assertCheckoutAllowed(orgCheckout("proSeats")),
		).resolves.toEqual({ trial: false });
	});

	it("trialOnce: the first checkout of the plan has the trial", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "ACTIVE"),
		]);
		await expect(assertCheckoutAllowed(orgCheckout("team"))).resolves.toEqual({
			trial: true,
		});
	});

	it.each(["CANCELED", "EXPIRED", "TRIALING", "PAST_DUE"])(
		"trialOnce: a second checkout of the plan has trial false (earlier purchase %s)",
		async (status) => {
			mockGetPurchasesByOrganizationId.mockResolvedValue([
				purchase("price_team", status),
			]);
			await expect(assertCheckoutAllowed(orgCheckout("team"))).resolves.toEqual(
				{ trial: false },
			);
		},
	);

	it("trialOnce: an earlier purchase through the no-trial product counts too", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_team_notrial", "CANCELED"),
		]);
		await expect(assertCheckoutAllowed(orgCheckout("team"))).resolves.toEqual({
			trial: false,
		});
	});

	it("skipTrial forces trial false", async () => {
		await expect(
			assertCheckoutAllowed({ ...orgCheckout("pro"), skipTrial: true }),
		).resolves.toEqual({ trial: false });
		await expect(
			assertCheckoutAllowed({ ...orgCheckout("team"), skipTrial: true }),
		).resolves.toEqual({ trial: false });
	});

	it("a registered policy can deny the trial", async () => {
		registerTrialEligibilityPolicy(() => false);
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: false,
		});
	});

	it("a policy builds on the defaults and sees the request and purchases", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_team", "CANCELED"),
		]);
		const policy = vi.fn(
			async (
				ctx: { userId: string },
				defaults: () => boolean,
			): Promise<boolean> => defaults() || ctx.userId === "user_vip",
		);
		registerTrialEligibilityPolicy(policy);

		await expect(assertCheckoutAllowed(orgCheckout("team"))).resolves.toEqual({
			trial: false,
		});
		await expect(
			assertCheckoutAllowed({ ...orgCheckout("team"), userId: "user_vip" }),
		).resolves.toEqual({ trial: true });

		expect(policy).toHaveBeenCalledWith(
			expect.objectContaining({
				owner: { organizationId: "org_1" },
				planId: "team",
				skipTrial: false,
				existingPurchases: [
					expect.objectContaining({ planId: "team", grantsAccess: false }),
				],
			}),
			expect.any(Function),
		);
	});

	it("a policy never grants a trial the plan does not offer or the caller skipped", async () => {
		const policy = vi.fn(() => true);
		registerTrialEligibilityPolicy(policy);
		await expect(
			assertCheckoutAllowed({ ...orgCheckout("pro"), skipTrial: true }),
		).resolves.toEqual({ trial: false });
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_pro", "ACTIVE"),
		]);
		await expect(
			assertCheckoutAllowed(orgCheckout("proSeats")),
		).resolves.toEqual({ trial: false });
		expect(policy).not.toHaveBeenCalled();
	});

	it("null restores the default decision", async () => {
		registerTrialEligibilityPolicy(() => false);
		registerTrialEligibilityPolicy(null);
		await expect(assertCheckoutAllowed(orgCheckout("pro"))).resolves.toEqual({
			trial: true,
		});
	});

	it("guards receive ctx.trial", async () => {
		mockGetPurchasesByOrganizationId.mockResolvedValue([
			purchase("price_team", "CANCELED"),
		]);
		const seen: boolean[] = [];
		unsubscribe.push(
			registerCheckoutGuard((ctx) => {
				seen.push(ctx.trial);
			}),
		);
		await assertCheckoutAllowed(orgCheckout("team"));
		await assertCheckoutAllowed(orgCheckout("pro"));
		expect(seen).toEqual([false, true]);
	});

	it("a guard can refuse based on the trial", async () => {
		unsubscribe.push(
			registerCheckoutGuard(({ trial, seats }) => {
				if (trial && (seats ?? 1) > 1) {
					throw new CheckoutRejectedError("trial_single_seat");
				}
			}),
		);
		await expect(
			assertCheckoutAllowed({ ...orgCheckout("pro"), seats: 3 }),
		).rejects.toMatchObject({ reason: "trial_single_seat" });
		await expect(
			assertCheckoutAllowed({
				...orgCheckout("pro"),
				seats: 3,
				skipTrial: true,
			}),
		).resolves.toEqual({ trial: false });
	});
});
