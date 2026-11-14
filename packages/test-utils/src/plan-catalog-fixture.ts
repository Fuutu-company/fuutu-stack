/**
 * Fixed plan catalog for kit tests — the catalog exports of
 * `@fuutu/payments/config`, frozen at the kit's demo shape (free /
 * subscription with trial + seats / custom enterprise). Kit tests that
 * assert plan behavior mock the config with it, so an app that replaces
 * `PLANS` / `LIMITS` / `CREDITS` / `FEATURE_CATALOG` / `CREDIT_TOPUPS`
 * keeps the kit suites green and meaningful:
 *
 * ```ts
 * vi.mock("@fuutu/payments/config", async (importOriginal) => ({
 *   ...(await importOriginal<typeof import("@fuutu/payments/config")>()),
 *   ...(await import("@fuutu/test-utils")).planCatalogFixture,
 * }));
 * ```
 *
 * Only the catalog is replaced — `paymentsConfig` and the helpers stay
 * real. Price IDs resolve through the kit's env var names
 * (`PAYMENTS_PRO_PRICE_ID`, …), which tests stub via `@fuutu/env/saas`.
 * Structurally typed on purpose: this package must not depend on the
 * app's `PlanId` union. Drift from the kit's catalog types fails
 * `check-types` in `packages/payments/src/__tests__/plan-catalog-fixture.test.ts`.
 */

const BILLING_CURRENCY = "usd";

const PLANS = {
	free: {
		tier: "free",
		amount: 0,
		currency: BILLING_CURRENCY,
		billingType: "free",
		displayPrice: "$0",
		showPriceSuffix: true,
		showInSaas: true,
		showInMarketing: true,
		saasCtaDisabled: true,
		seatBased: undefined,
	},
	pro: {
		tier: "pro",
		amount: 1900,
		currency: BILLING_CURRENCY,
		billingType: "subscription",
		interval: "month",
		trialDays: 14,
		seatBased: true,
		displayPrice: "$19",
		yearlyDisplayPrice: "$190",
		showPriceSuffix: true,
		yearlyShowPriceSuffix: true,
		highlight: true,
		showInSaas: true,
		showInMarketing: true,
		priceIdEnvVars: {
			month: "PAYMENTS_PRO_PRICE_ID",
			year: "PAYMENTS_PRO_YEARLY_PRICE_ID",
		},
	},
	enterprise: {
		tier: "enterprise",
		amount: -1,
		currency: BILLING_CURRENCY,
		billingType: "custom",
		displayPrice: "—",
		showInSaas: true,
		showInMarketing: true,
		seatBased: undefined,
		marketingCtaHref: "mailto:sales@example.com",
	},
} as const;

const LIMITS = {
	free: {
		organizations: 1,
		membersPerOrg: 5,
		apiKeys: 2,
		webhooks: false,
		storageMb: 500,
		auditLogDays: false,
	},
	pro: {
		organizations: 10,
		membersPerOrg: 50,
		apiKeys: "unlimited",
		webhooks: 10,
		storageMb: 50_000,
		auditLogDays: 30,
	},
	enterprise: {
		organizations: "unlimited",
		membersPerOrg: "unlimited",
		apiKeys: "unlimited",
		webhooks: "unlimited",
		storageMb: "unlimited",
		auditLogDays: "unlimited",
	},
} as const;

const CREDITS = {
	free: { ai_tokens: 10_000, api_calls: 1_000, documents: 50 },
	pro: { ai_tokens: 500_000, api_calls: 50_000, documents: "unlimited" },
	enterprise: {
		ai_tokens: "unlimited",
		api_calls: "unlimited",
		documents: "unlimited",
	},
} as const;

const CREDIT_TOPUPS = [
	{
		id: "ai_tokens_100k",
		meterKey: "ai_tokens",
		amount: 100_000,
		displayPrice: "$10",
		priceIdEnvVar: "CREDITS_AI_TOKENS_100K_PRICE_ID",
		popular: true,
	},
	{
		id: "ai_tokens_500k",
		meterKey: "ai_tokens",
		amount: 500_000,
		displayPrice: "$40",
		priceIdEnvVar: "CREDITS_AI_TOKENS_500K_PRICE_ID",
	},
	{
		id: "api_calls_50k",
		meterKey: "api_calls",
		amount: 50_000,
		displayPrice: "$5",
		priceIdEnvVar: "CREDITS_API_CALLS_50K_PRICE_ID",
	},
] as const;

const TIER_ORDER = ["free", "pro", "enterprise"] as const;

const FEATURE_CATALOG = {
	auth: {
		passkeys: { tier: "pro" },
		sso: { tier: "enterprise" },
	},
	orgs: {
		orgs: { tier: "free", limitKey: "organizations" },
		members: { tier: "free", limitKey: "membersPerOrg" },
		audit: { tier: "pro", limitKey: "auditLogDays" },
	},
	api: {
		keys: { tier: "free", limitKey: "apiKeys" },
		webhooks: { tier: "pro", limitKey: "webhooks" },
	},
	infrastructure: {
		storage: { tier: "free", limitKey: "storageMb" },
	},
	support: {
		community: { tier: "free" },
		email: { tier: "pro" },
		dedicated: { tier: "enterprise" },
		sla: { tier: "enterprise" },
	},
} as const;

/** Plan ids of `planCatalogFixture` (`"free" | "pro" | "enterprise"`). */
export type FixturePlanId = keyof typeof PLANS;

/**
 * A fixture plan id where the code under test expects the app's `PlanId`.
 * Kit tests run against `planCatalogFixture`, so its ids are valid at
 * runtime under any app catalog; this keeps them type-checking too (a
 * bare `"pro"` fails `check-types` once the app's `PlanId` drops it).
 * `Id` is inferred from a `PlanId`-typed parameter; pass it where the
 * call site is generic (oRPC `call` input):
 *
 * ```ts
 * getPlanPriceId(fixturePlanId("pro"), "month");
 * call(router.checkout.create, { planId: fixturePlanId<PlanId>("pro") }, opts);
 * ```
 */
export function fixturePlanId<Id extends string>(id: FixturePlanId): Id {
	return id as string as Id;
}

export const planCatalogFixture = {
	BILLING_CURRENCY,
	PLANS,
	PLAN_IDS: Object.keys(PLANS) as (keyof typeof PLANS)[],
	LIMITS,
	CREDITS,
	CREDIT_TOPUPS,
	TIER_ORDER,
	FEATURE_CATALOG,
};
