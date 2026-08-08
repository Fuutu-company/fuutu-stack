"use client";

import { authClient } from "@fuutu/auth/client";
import {
	buildPricingTiers,
	type PlanId,
	type PlanTranslations,
} from "@fuutu/payments/plans";
import { PricingCompact } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function ChoosePlan() {
	const t = useTranslations("payments");
	const [loading, setLoading] = useState<PlanId | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function checkout(planId: PlanId) {
		setLoading(planId);
		setError(null);
		try {
			if (typeof authClient.checkout !== "function") {
				setError(t("choosePlan.unavailable"));
				return;
			}
			const res = await authClient.checkout({ products: [planId] });
			if (res?.error) {
				setError(res.error.message ?? t("choosePlan.error"));
			}
		} catch (e) {
			setError((e as Error).message);
		} finally {
			setLoading(null);
		}
	}

	const resolve = (id: PlanId): PlanTranslations => ({
		name: t(`plans.${id}.name`),
		description: t(`plans.${id}.description`),
		priceSuffix: t(`plans.${id}.priceSuffix`),
		yearlyPriceSuffix: t(`plans.${id}.yearlyPriceSuffix`),
		featureLabels: t.raw(`plans.${id}.featureLabels`) as Record<string, string>,
		ctaLabel:
			loading === id ? t("choosePlan.redirecting") : t(`plans.${id}.ctaLabel`),
	});

	const tiers = buildPricingTiers({
		audience: "saas",
		t: resolve,
		onCtaClick: checkout,
		loadingId: loading,
		allDisabled: loading !== null,
	});

	return (
		<div className="space-y-6">
			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}
			<PricingCompact
				tiers={tiers}
				popularLabel={t("choosePlan.popular")}
				monthlyLabel={t("choosePlan.monthly")}
				yearlyLabel={t("choosePlan.yearly")}
				yearlyBadge={t("choosePlan.yearlyBadge")}
			/>
		</div>
	);
}
