"use client";

import { PLANS, type Plan, TIER_ORDER } from "@fuutu/payments/config";
import {
	FEATURE_GROUPS,
	formatLimit,
	getFeaturesForTier,
	getLimit,
} from "@fuutu/payments/features";
import {
	buildPricingTiers,
	type PlanId,
	type PlanTranslations,
} from "@fuutu/payments/plans";
import {
	type FeatureMatrixRow,
	PricingCompact,
	PricingFull,
	type PricingTier,
} from "@fuutu/ui";
import { SectionHeading } from "@marketing/home/components/section-heading";
import { Building2, Rocket, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { urls } from "@/lib/urls";
import { Link } from "@/navigation";

/** Tier icon by billing type: free, custom (contact sales), paid. */
function iconFor(id: PlanId): PricingTier["icon"] {
	const { billingType } = PLANS[id] as Plan;
	if (billingType === "free") return Sparkles;
	if (billingType === "custom") return Building2;
	return Rocket;
}

function hrefFor(id: PlanId): string | undefined {
	// A plan with its own marketing CTA (e.g. contact sales) keeps it.
	if ((PLANS[id] as Plan).marketingCtaHref) return undefined;
	return `${urls.auth.signUp}?plan=${id}`;
}

function usePricingData() {
	const t = useTranslations();

	const resolve = (id: PlanId): PlanTranslations => ({
		name: t(`payments.plans.${id}.name`),
		description: t(`payments.plans.${id}.description`),
		priceSuffix: t(`payments.plans.${id}.priceSuffix`),
		yearlyPriceSuffix: t(`payments.plans.${id}.yearlyPriceSuffix`),
		featureLabels: t.raw(`payments.plans.${id}.featureLabels`) as Record<
			string,
			string
		>,
		ctaLabel: t(`payments.plans.${id}.ctaLabel`),
	});

	const tiers = buildPricingTiers({
		audience: "marketing",
		t: resolve,
		hrefFor,
	}).map((tier) => ({ ...tier, icon: iconFor(tier.id as PlanId) }));

	const rawFeatures = t.raw("payments.features") as Record<
		string,
		Record<string, string> | string
	>;

	function getFeatureLabel(id: string): string {
		const parts = id.split("_");
		const prefix = parts[0] ?? "";
		const key = parts.slice(1).join("_");
		const section = rawFeatures[prefix];
		if (section && typeof section === "object") {
			return (section as Record<string, string>)[key] ?? id;
		}
		return id;
	}

	// Every catalog feature up to the highest tier — the matrix rows.
	const allFeatures = getFeaturesForTier(TIER_ORDER[TIER_ORDER.length - 1]);

	const featureTooltips = t.raw("payments.features.tooltips") as Record<
		string,
		string
	>;

	const featureMatrix: FeatureMatrixRow[] = allFeatures.map((feature) => ({
		id: feature.id,
		label: getFeatureLabel(feature.id),
		group: feature.group,
		tooltip: featureTooltips[feature.id],
		values: Object.fromEntries(
			tiers.map((tier) => {
				const hasFeature = tier.featureIds?.includes(feature.id) ?? false;
				if (!hasFeature) return [tier.id, false];
				if (feature.limitKey) {
					return [
						tier.id,
						formatLimit(getLimit(tier.id as PlanId, feature.limitKey)),
					];
				}
				return [tier.id, true];
			}),
		),
	}));

	const groups = rawFeatures.groups as Record<string, string>;
	const featureGroupLabels = Object.fromEntries(
		FEATURE_GROUPS.map((g) => [g, groups?.[g] ?? g]),
	);

	return { t, tiers, featureMatrix, featureGroupLabels };
}

/** Used on the home page — compact cards + enterprise banner. */
export function PricingCardsHome() {
	const { t, tiers } = usePricingData();

	const enterpriseHighlights = [
		{
			label: t("pricing.enterprise.dedicated_support"),
			description: t("pricing.enterprise.dedicated_support_desc"),
		},
		{
			label: t("pricing.enterprise.dedicated_app"),
			description: t("pricing.enterprise.dedicated_app_desc"),
		},
		{
			label: t("pricing.enterprise.sla"),
			description: t("pricing.enterprise.sla_desc"),
		},
		{
			label: t("pricing.enterprise.custom_integrations"),
			description: t("pricing.enterprise.custom_integrations_desc"),
		},
	];

	return (
		<section id="pricing" className="scroll-mt-28 px-4 pt-24 sm:px-6 md:pt-32">
			<div className="mx-auto max-w-6xl">
				<SectionHeading
					title={t("home.pricing.title")}
					description={t("home.pricing.description")}
					className="mb-12 md:mb-14"
				/>
				<PricingCompact
					tiers={tiers}
					popularLabel={t("payments.choosePlan.popular")}
					moreLabel={t("pricing.moreFeatures")}
					pricingHref="/pricing"
					seeAllLabel={t("pricing.seeAll")}
					enterpriseHighlights={enterpriseHighlights}
					LinkComponent={Link}
					monthlyLabel={t("payments.choosePlan.monthly")}
					yearlyLabel={t("payments.choosePlan.yearly")}
					yearlyBadge={t("payments.choosePlan.yearlyBadge")}
				/>
			</div>
		</section>
	);
}

/** Used on the /pricing page — full feature comparison matrix with tooltips. */
export function PricingCardsPage() {
	const { t, tiers, featureMatrix, featureGroupLabels } = usePricingData();

	return (
		<section className="px-4 pt-12 sm:px-6 md:pt-16">
			<div className="mx-auto max-w-6xl">
				<PricingFull
					tiers={tiers}
					featureMatrix={featureMatrix}
					featureGroupLabels={featureGroupLabels}
					customPriceLabel={t("pricing.customPrice")}
					popularLabel={t("payments.choosePlan.popular")}
					LinkComponent={Link}
					monthlyLabel={t("payments.choosePlan.monthly")}
					yearlyLabel={t("payments.choosePlan.yearly")}
					yearlyBadge={t("payments.choosePlan.yearlyBadge")}
				/>
			</div>
		</section>
	);
}
