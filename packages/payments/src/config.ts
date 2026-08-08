/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Payments configuration — the ONLY file you need to edit.
 *
 *  1. `paymentsConfig`  → which provider, how billing is attached
 *  2. `PLANS`           → your pricing plans (price, billing type, visibility)
 *  3. `LIMITS`          → per-plan resource caps (used for runtime gates + pricing display)
 *
 * Provider-side IDs (Polar product IDs, Stripe price IDs etc.) live in env vars
 * because sandbox and production have different values — see @fuutu/env/saas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { config } from "@fuutu/config";

// ─── 1. Provider ──────────────────────────────────────────────────────────────

export type PaymentProviderId =
	| "polar"
	| "stripe"
	| "lemonsqueezy"
	| "creem"
	| "dodopayments"
	| "noop";

export type BillingAttachedTo = "user" | "organization";

export interface PaymentsConfig {
	provider: PaymentProviderId;
	/**
	 * Whether billing is per-user or per-organization.
	 * Derived from organizationsMode: "organization" when orgs are on,
	 * "user" when orgs are off.
	 */
	billingAttachedTo: BillingAttachedTo;
	/** Gate every protected route behind an active paid plan. */
	requireActiveSubscription: boolean;
}

export const paymentsConfig: PaymentsConfig = {
	provider: "polar",
	billingAttachedTo:
		config.features.organizationsMode !== "off" ? "organization" : "user",
	requireActiveSubscription: false,
};

// ─── 2. Plans ─────────────────────────────────────────────────────────────────

export type PlanId = "free" | "pro" | "enterprise";

/** -1 = custom price (no checkout), 0 = free */
export type PlanAmount = number;

export interface Plan {
	/** Price in cents (e.g. 1900 = $19.00). 0 = free. -1 = negotiated/custom. */
	amount: PlanAmount;
	currency: string;
	/** "subscription" = recurring, "one_time" = single charge, "free" / "custom" = no checkout */
	billingType: "free" | "subscription" | "one_time" | "custom";
	/** Only for subscription plans. */
	interval?: "month" | "year";
	/** Free trial in days. Omit for no trial. */
	trialDays?: number;
	/** Seat-based billing — checkout must pass current member count. */
	seatBased?: boolean;
	/** Display string shown in pricing UI (e.g. "$19"). */
	displayPrice: string;
	/** Optional yearly display price (e.g. "$190"). Shown when billing toggle is yearly. */
	yearlyDisplayPrice?: string;
	/** Append i18n suffix from `payments.plans.<id>.priceSuffix`. */
	showPriceSuffix?: boolean;
	/** Append i18n yearly suffix from `payments.plans.<id>.yearlyPriceSuffix`. */
	yearlyShowPriceSuffix?: boolean;
	/** Highlight this plan in pricing UI (pick one). */
	highlight?: boolean;
	/** Show in SaaS in-app upgrade page. */
	showInSaas: boolean;
	/** Show in marketing pricing page. */
	showInMarketing: boolean;
	/** SaaS CTA is disabled (e.g. already on this plan). */
	saasCtaDisabled?: boolean;
	/** Override the CTA href in marketing (default: sign-up link). */
	marketingCtaHref?: string;
	/**
	 * Provider-side product/price ID (e.g. Polar product ID, Stripe price ID).
	 * Env-backed — not set in static PLANS because sandbox and production differ.
	 * Injected at runtime by the consuming page/component from env vars.
	 * Used to map active subscriptions back to plan IDs.
	 */
	productId?: string;
}

export const PLANS = {
	free: {
		amount: 0,
		currency: "usd",
		billingType: "free",
		displayPrice: "$0",
		showPriceSuffix: true,
		showInSaas: true,
		showInMarketing: true,
		saasCtaDisabled: true,
	},
	pro: {
		amount: 1900,
		currency: "usd",
		billingType: "subscription",
		interval: "month",
		trialDays: 14,
		displayPrice: "$19",
		yearlyDisplayPrice: "$190",
		showPriceSuffix: true,
		yearlyShowPriceSuffix: true,
		highlight: true,
		showInSaas: true,
		showInMarketing: true,
	},
	enterprise: {
		amount: -1,
		currency: "usd",
		billingType: "custom",
		displayPrice: "—",
		showInSaas: true,
		showInMarketing: true,
		marketingCtaHref: "mailto:license@fuutu.com",
	},
} as const satisfies Record<PlanId, Plan>;

// ─── 3. Limits ────────────────────────────────────────────────────────────────

/**
 * Per-plan resource caps.
 * - number   = hard cap (e.g. 10 orgs)
 * - "unlimited" = no cap
 * - false    = feature not available on this plan
 *
 * Used by runtime gates (server-side enforcement) AND the pricing matrix display.
 */
export type LimitValue = number | "unlimited" | false;

export interface PlanLimits {
	organizations: LimitValue;
	membersPerOrg: LimitValue;
	apiKeys: LimitValue;
	storageMb: LimitValue;
	auditLogDays: LimitValue;
}

export const LIMITS = {
	free: {
		organizations: 1,
		membersPerOrg: 5,
		apiKeys: 2,
		storageMb: 500,
		auditLogDays: false,
	},
	pro: {
		organizations: 10,
		membersPerOrg: 50,
		apiKeys: "unlimited",
		storageMb: 50_000,
		auditLogDays: 30,
	},
	enterprise: {
		organizations: "unlimited",
		membersPerOrg: "unlimited",
		apiKeys: "unlimited",
		storageMb: "unlimited",
		auditLogDays: "unlimited",
	},
} as const satisfies Record<PlanId, PlanLimits>;

// ─── 4. Features ────────────────────────────────────────────────────────────────

export type PlanTier = "free" | "pro" | "enterprise";

export interface FeatureEntry {
	/** Minimum tier required. "free" = all plans. */
	tier: PlanTier;
	/** Links to LIMITS[planId][limitKey] for matrix display. */
	limitKey?: keyof PlanLimits;
	/** Hide from pricing UI (default: shown). */
	hidden?: boolean;
}

/**
 * Feature catalog — grouped by category.
 * Add a feature by adding an entry. Remove it by deleting the line.
 *
 * Intentionally excluded (same on all plans — not a purchase decision factor):
 *   auth: email, oauth, mfa   — all plans ship Better Auth fully
 *   orgs: rbac, invites       — always included
 *   api:  openapi             — always included
 *   infra: i18n               — kit capability, not a plan gate
 */
export const FEATURE_CATALOG = {
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
		webhooks: { tier: "pro" },
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
} as const satisfies Record<string, Record<string, FeatureEntry>>;

// ─── Derived helpers (do not edit) ────────────────────────────────────────────

/** All plan IDs, in display order. */
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/** Plans visible in the SaaS in-app upgrade page. */
export const SAAS_PLANS = PLAN_IDS.filter((id) => PLANS[id].showInSaas);

/** Plans visible on the marketing pricing page. */
export const MARKETING_PLANS = PLAN_IDS.filter(
	(id) => PLANS[id].showInMarketing,
);

export type AudienceId = "saas" | "marketing";
export type BillingType = Plan["billingType"];
export type BillingInterval = NonNullable<Plan["interval"]>;
