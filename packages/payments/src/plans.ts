/**
 * Pricing tier builder — pure render-time logic only.
 *
 * All commercial decisions (plan IDs, prices, limits, audience visibility)
 * live in `./config`. This file only contains the i18n resolver types and
 * `buildPricingTiers()` which assembles `BuiltPricingTier[]` for the UI.
 *
 * Adding a plan:
 *   1. Add entry to `PLANS` + `LIMITS` in `./config`.
 *   2. Add `payments.plans.<id>.*` keys to every translation file.
 */

import {
	type AudienceId,
	PLAN_IDS,
	PLANS,
	type Plan,
	type PlanId,
} from "./config";
import { getPricingFeaturesForPlan } from "./features";

/**
 * Minimal message shape consumed by `buildPricingTiers`. Apps pass the
 * already-loaded i18n namespace (next-intl `useMessages()` / `getMessages()`).
 */
export interface PlanTranslations {
	name: string;
	description: string;
	priceSuffix?: string;
	yearlyPriceSuffix?: string;
	/** Localized labels keyed by CatalogFeature.id — used by detailed/full variants. */
	featureLabels: Record<string, string>;
	ctaLabel: string;
}

export type PlanTranslationResolver = (id: PlanId) => PlanTranslations;

export interface BuildPricingTiersOptions {
	audience: AudienceId;
	t: PlanTranslationResolver;
	/** Per-plan CTA click handler (SaaS checkout). Takes precedence over catalog href. */
	onCtaClick?: (id: PlanId) => void;
	/** Per-plan href override (e.g. marketing → sign-up with plan param). */
	hrefFor?: (id: PlanId) => string | undefined;
	/** Per-plan loading state (disables CTA while a checkout is in flight). */
	loadingId?: PlanId | null;
	/** Per-plan disabled state (while another CTA is pending). */
	allDisabled?: boolean;
}

/**
 * Provider-agnostic pricing tier shape — kept in sync with `@fuutu/ui`'s
 * `PricingTier`. Duplicated here (shape only) to avoid a circular dep
 * between payments and ui.
 */
export interface BuiltPricingTier {
	id: string;
	name: string;
	description: string;
	price: string;
	priceSuffix?: string;
	/** Optional yearly price shown when billing toggle is switched to yearly. */
	yearlyPrice?: string;
	yearlyPriceSuffix?: string;
	/** Localized feature label strings for compact/detailed display. */
	features: string[];
	/** Parallel array of CatalogFeature ids — for matrix rendering in full variant. */
	featureIds: string[];
	highlighted?: boolean;
	ctaLabel: string;
	ctaHref?: string;
	onCtaClick?: () => void;
	disabled?: boolean;
}

/**
 * Build fully-localized pricing tiers for a given audience. Pure function —
 * no side effects, safe to call from Server or Client Components.
 */
export function buildPricingTiers(
	options: BuildPricingTiersOptions,
): BuiltPricingTier[] {
	const { audience, t, onCtaClick, hrefFor, loadingId, allDisabled } = options;
	const showKey = audience === "saas" ? "showInSaas" : "showInMarketing";

	return PLAN_IDS.filter((id) => (PLANS[id] as Plan)[showKey]).map((planId) => {
		const plan = PLANS[planId] as Plan;
		const tr = t(planId);
		const isLoading = loadingId === planId;
		const ctaDisabled = audience === "saas" ? plan.saasCtaDisabled : false;
		const catalogHref =
			audience === "marketing" ? plan.marketingCtaHref : undefined;
		const href = hrefFor?.(planId) ?? catalogHref;
		const catalogFeatures = getPricingFeaturesForPlan(planId);
		const featureIds = catalogFeatures.map((f) => f.id);
		const features = featureIds.map((id) => tr.featureLabels[id] ?? id);

		return {
			id: planId,
			name: tr.name,
			description: tr.description,
			price: plan.displayPrice,
			priceSuffix: plan.showPriceSuffix ? tr.priceSuffix : undefined,
			yearlyPrice: plan.yearlyDisplayPrice,
			yearlyPriceSuffix: plan.yearlyShowPriceSuffix
				? tr.yearlyPriceSuffix
				: undefined,
			features,
			featureIds,
			highlighted: plan.highlight,
			ctaLabel: tr.ctaLabel,
			ctaHref: onCtaClick ? undefined : href,
			onCtaClick:
				onCtaClick && !ctaDisabled ? () => onCtaClick(planId) : undefined,
			disabled: ctaDisabled || isLoading || (allDisabled ?? false),
		};
	});
}

export type { PlanId } from "./config";
/** Re-export so consumers can use a single `@fuutu/payments/plans` import. */
export { getPricingFeaturesForPlan, planIdToTier } from "./features";
