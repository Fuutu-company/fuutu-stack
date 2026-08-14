"use client";

import { paymentsConfig, PLANS, type PlanId } from "@fuutu/payments/config";
import {
	buildPricingTiers,
	type PlanTranslations,
} from "@fuutu/payments/plans";
import { PricingCompact, SeatSelector } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { orpc } from "@/utils/orpc";

export function ChoosePlan({
	priceIds,
}: {
	priceIds: Partial<Record<PlanId, string>>;
}) {
	const t = useTranslations("payments");
	const [loading, setLoading] = useState<PlanId | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [seatCount, setSeatCount] = useState(1);

	// Seat-based billing only makes sense on organization level.
	// When billing is attached to "user", seat-based plans are billed as
	// a single seat (the user themselves) — no selector needed.
	// When billing is attached to "organization", the seat selector lives
	// in the org billing settings page, not here.
	const isOrgBilling = paymentsConfig.billingAttachedTo === "organization";
	const showSeatSelector =
		!isOrgBilling && Object.values(PLANS).some((plan) => plan.seatBased);

	async function checkout(planId: PlanId) {
		const priceId = priceIds[planId];
		if (!priceId) {
			setError(t("choosePlan.unavailable"));
			return;
		}
		setLoading(planId);
		setError(null);
		try {
			const plan = PLANS[planId];
			const seats = plan.seatBased ? seatCount : undefined;
			const result = await orpc.payments.checkout.create.call({
				priceId,
				successUrl: "/dashboard",
				cancelUrl: "/choose-plan",
				seats,
			});
			if (result?.url) {
				window.location.href = result.url;
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
		seatCountFor: (id) => (PLANS[id].seatBased ? seatCount : undefined),
	});

	// Get the Pro plan for seat selector (it's the seat-based plan)
	const proPlan = PLANS.pro;

	return (
		<div className="space-y-6">
			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}

			{showSeatSelector && proPlan && (
				<SeatSelector
					seatCount={seatCount}
					onChange={setSeatCount}
					pricePerSeat={proPlan.amount}
					currency={proPlan.currency}
					interval={proPlan.interval}
					translations={{
						title: t("seatSelector.title"),
						seat: t("seatSelector.seat"),
						seats: t("seatSelector.seats"),
						perMonth: t("seatSelector.perMonth"),
						perYear: t("seatSelector.perYear"),
						description: t("seatSelector.description"),
					}}
				/>
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
