/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Payments configuration — the ONLY file you need to edit.
 *
 *  1. `paymentsConfig`  → which provider, how billing is attached
 *  2. `PLANS`           → your pricing plans (price, billing type, visibility)
 *  3. `LIMITS`          → per-plan resource caps (used for runtime gates + pricing display)
 *  4. `CREDITS`         → per-plan credit grants (recurring, reset each period)
 *
 * Provider-side IDs (Polar product IDs, Stripe price IDs etc.) live in env vars
 * because sandbox and production have different values — see @fuutu/env/saas.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { config } from "@fuutu/config";
import { createLogger } from "@fuutu/logs";
import type { PaymentProvider } from "./types";

const log = createLogger({ scope: "payments" });

// ─── 1. Provider ──────────────────────────────────────────────────────────────
// Providers not shipped with the kit (e.g. LemonSqueezy, DodoPayments) are
// integrated via `provider: "custom"` + `paymentsConfig.customProvider` —
// they intentionally have no union member of their own.

export type PaymentProviderId =
	| "polar"
	| "stripe"
	| "creem"
	| "custom"
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
	/**
	 * Whether the credits system (usage metering + top-up packages) is enabled.
	 * When false: credit pages, tabs, and routes are hidden from the UI.
	 * The @fuutu/credits package and webhook sync logic remain in the
	 * codebase but are not surfaced to the user.
	 * Derived from config.features.credits.
	 */
	creditsEnabled: boolean;
	/**
	 * Custom provider implementation — only used when `provider === "custom"`.
	 * Kit users implement the `PaymentProvider` interface and pass their
	 * instance here. This is the extension seam for providers not shipped
	 * with the kit (e.g. LemonSqueezy, DodoPayments, or a proprietary system).
	 */
	customProvider?: PaymentProvider;
}

export const paymentsConfig: PaymentsConfig = {
	// Active payment provider — edit this to switch between "polar", "stripe",
	// "creem", "custom", or "noop". Runtime overrides must go through
	// `setPaymentProvider()` — a direct `paymentsConfig.provider = "x"`
	// assignment bypasses the `config.features.payments` guard.
	// This is the primary configuration point for kit users.
	//
	// `config.features.payments === false` is the master off-switch: it
	// derives the "noop" provider and cannot be overridden at runtime.
	//
	// `config.ts` must stay client-safe (no `@fuutu/env/saas` import at module
	// level) because client components import `paymentsConfig` for display logic.
	// The SaaS app's `instrumentation.ts` can optionally override this at server
	// startup via `setPaymentProvider(env.PAYMENTS_PROVIDER)` when the env var
	// is set — useful for deploys where the provider differs per environment.
	// `!== true` instead of `=== false`: config.features is `as const`, so the
	// flag's declared type is a literal — a `=== false` comparison has no type
	// overlap and fails TS2367.
	provider: config.features.payments !== true ? "noop" : "creem",
	billingAttachedTo:
		config.features.organizationsMode !== "off" ? "organization" : "user",
	requireActiveSubscription: false,
	creditsEnabled: config.features.credits ?? true,
};

/**
 * Whether a real payment provider is active. False when the provider is
 * "noop" — either set directly or derived from `config.features.payments`.
 */
export function isPaymentsEnabled(): boolean {
	return paymentsConfig.provider !== "noop";
}

/**
 * Override the active payment provider at server-app startup.
 * Called from the SaaS app's `instrumentation.ts` only when `PAYMENTS_PROVIDER`
 * env var is set — otherwise the `paymentsConfig.provider` default above wins.
 * Client components must never call this.
 *
 * When `config.features.payments === false` the flag is the master
 * off-switch — this call warns and leaves the noop provider in place.
 */
export function setPaymentProvider(provider: PaymentProviderId): void {
	if (config.features.payments !== true) {
		log.warn(
			`setPaymentProvider("${provider}") ignored — config.features.payments is false`,
		);
		return;
	}
	paymentsConfig.provider = provider;
}

// ─── 1b. Credit Top-Up Packages ─────────────────────────────────────────────────
// Top-up credit packages do not expire.
// Labels/descriptions come from i18n keys, not this catalog — adding a
// package requires `credits.topup.packages.<id>.{label,description}` in
// every locale (enforced by check-translations.mjs).

export interface CreditTopupPackage {
	id: string;
	meterKey: string;
	amount: number;
	displayPrice: string;
	priceIdEnvVar: string;
	popular?: boolean;
}

export const CREDIT_TOPUPS: CreditTopupPackage[] = [
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
];

// getCreditTopupPriceId lives in ./config.server (needs env access).
// All callers are server-only (oRPC procedures, webhook sync).

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
	/**
	 * Env var names holding the provider-side price/product ID per billing
	 * interval (mirrors `CREDIT_TOPUPS[].priceIdEnvVar`). Resolved
	 * server-side via `getPlanPriceId()` in `./config.server` — a
	 * checkoutable plan without a mapping fails closed at checkout.
	 */
	priceIdEnvVars?: { month?: string; year?: string };
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
		seatBased: undefined,
	},
	pro: {
		amount: 1900,
		currency: "usd",
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
		amount: -1,
		currency: "usd",
		billingType: "custom",
		displayPrice: "—",
		showInSaas: true,
		showInMarketing: true,
		seatBased: undefined,
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
	webhooks: LimitValue;
	storageMb: LimitValue;
	auditLogDays: LimitValue;
}

export const LIMITS = {
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
} as const satisfies Record<PlanId, PlanLimits>;

// ─── 4. Credits ────────────────────────────────────────────────────────────────

/**
 * Per-plan credit grants (recurring, reset each period).
 * - number = exact amount per period
 * - "unlimited" = no limit
 * - 0 or missing = no credits for this meter on this plan
 */
export const CREDITS: Record<PlanId, Record<string, LimitValue>> = {
	free: {
		ai_tokens: 10_000,
		api_calls: 1_000,
		documents: 50,
	},
	pro: {
		ai_tokens: 500_000,
		api_calls: 50_000,
		documents: "unlimited",
	},
	enterprise: {
		ai_tokens: "unlimited",
		api_calls: "unlimited",
		documents: "unlimited",
	},
};

// ─── 5. Features ────────────────────────────────────────────────────────────────

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
} as const satisfies Record<string, Record<string, FeatureEntry>>;

// ─── Derived helpers (do not edit) ────────────────────────────────────────────

/** All plan IDs, in display order. */
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export type AudienceId = "saas" | "marketing";
export type BillingType = Plan["billingType"];
export type BillingInterval = NonNullable<Plan["interval"]>;
