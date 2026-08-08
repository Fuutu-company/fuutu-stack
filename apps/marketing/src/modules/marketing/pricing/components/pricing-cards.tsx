"use client";

import { env } from "@fuutu/env/marketing";
import {
	FEATURE_GROUPS,
	formatLimit,
	getLimit,
	getPricingFeaturesForPlan,
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
import { Building2, Rocket, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/navigation";

const SAAS_URL = env.NEXT_PUBLIC_SAAS_URL ?? "https://stackapp.fuutu.com";

const PLAN_ICONS: Partial<Record<PlanId, PricingTier["icon"]>> = {
	free: Sparkles,
	pro: Rocket,
	enterprise: Building2,
};

function hrefFor(id: PlanId): string | undefined {
	if (id === "enterprise") return "mailto:license@fuutu.com";
	return `${SAAS_URL}/auth/sign-up?plan=${id}`;
}

type LocalizedVideo = string | { default: string; [locale: string]: string };

const FEATURE_VIDEOS: Partial<Record<string, LocalizedVideo>> = {
	auth_passkeys: "https://www.w3schools.com/html/mov_bbb.mp4",
};

function resolveVideo(entry: LocalizedVideo, locale: string): string {
	if (typeof entry === "string") return entry;
	return entry[locale] ?? entry.default;
}

function usePricingData() {
	const t = useTranslations();
	const locale = useLocale();

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
	}).map((tier) => ({ ...tier, icon: PLAN_ICONS[tier.id as PlanId] }));

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

	const allFeatures = getPricingFeaturesForPlan("enterprise");

	const featureTooltips = t.raw("payments.features.tooltips") as Record<
		string,
		string
	>;

	const featureMatrix: FeatureMatrixRow[] = allFeatures.map((feature) => ({
		id: feature.id,
		label: getFeatureLabel(feature.id),
		group: feature.group,
		tooltip: featureTooltips[feature.id],
		videoSrc: FEATURE_VIDEOS[feature.id]
			? resolveVideo(FEATURE_VIDEOS[feature.id] as LocalizedVideo, locale)
			: undefined,
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
		<section className="py-24 md:py-32">
			<div className="container mx-auto max-w-6xl px-4">
				<div className="mb-14 max-w-2xl">
					<p className="mb-3 font-mono text-primary text-xs uppercase tracking-widest">
						{t("pricing.eyebrow")}
					</p>
					<h2 className="mb-3 font-bold text-4xl tracking-tight md:text-5xl">
						{t("pricing.title")}
					</h2>
					<p className="text-lg text-muted-foreground">
						{t("pricing.description")}
					</p>
				</div>
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
		<section className="py-16 md:py-24">
			<div className="container mx-auto max-w-6xl px-4">
				<PricingFull
					tiers={tiers}
					featureMatrix={featureMatrix}
					featureGroupLabels={featureGroupLabels}
					popularLabel={t("payments.choosePlan.popular")}
					watchLabel={t("pricing.watchDemo")}
					LinkComponent={Link}
					monthlyLabel={t("payments.choosePlan.monthly")}
					yearlyLabel={t("payments.choosePlan.yearly")}
					yearlyBadge={t("payments.choosePlan.yearlyBadge")}
				/>
			</div>
		</section>
	);
}
