"use client";

import { createLogger } from "@fuutu/logs";
import { PLANS, type PlanId } from "@fuutu/payments/config";
import {
	buildPricingTiers,
	type PlanTranslations,
} from "@fuutu/payments/plans";
import { Badge, Button, Card, CardContent, PricingCompact } from "@fuutu/ui";
import { CreditCard, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { orpc } from "@/utils/orpc";

const log = createLogger({ scope: "user-billing" });

type ActiveSubscription = {
	id: string;
	status: string;
	productId: string | null;
	currentPeriodEnd?: Date | null;
};

export function UserSettingsBilling({
	priceIds,
}: {
	priceIds: Partial<Record<PlanId, string>>;
}) {
	const t = useTranslations();
	const tp = useTranslations("payments");
	const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null);
	const [loading, setLoading] = useState(true);
	const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const sub = await orpc.payments.subscription.active.call({});
			if (sub) {
				setActiveSub({
					id: sub.id,
					status: sub.status,
					productId: sub.productId ?? null,
					currentPeriodEnd: sub.currentPeriodEnd ?? null,
				});
			}
		} catch (err) {
			log.warn("subscription fetch failed", { err });
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	const activePlanId: PlanId = (() => {
		if (!activeSub?.productId) return "free";
		for (const id of Object.keys(PLANS) as PlanId[]) {
			const planPriceId = priceIds[id];
			if (planPriceId && planPriceId === activeSub.productId) {
				return id;
			}
		}
		return "free";
	})();

	async function checkout(planId: PlanId) {
		const priceId = priceIds[planId];
		if (!priceId) {
			setError(tp("choosePlan.unavailable"));
			return;
		}
		setCheckoutLoading(planId);
		setError(null);
		try {
			const result = await orpc.payments.checkout.create.call({
				priceId,
				successUrl: "/settings?tab=billing",
				cancelUrl: "/settings?tab=billing",
			});
			if (result?.url) {
				window.location.href = result.url;
			}
		} catch (e) {
			log.error("checkout failed", { err: e });
			setError(tp("choosePlan.error"));
		} finally {
			setCheckoutLoading(null);
		}
	}

	async function openPortal() {
		try {
			const result = await orpc.payments.portal.open.call({
				returnUrl: "/settings?tab=billing",
			});
			if (result?.url) {
				window.location.href = result.url;
			}
		} catch (err) {
			log.warn("portal failed", { err });
		}
	}

	if (loading) {
		return (
			<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
		);
	}

	const resolve = (id: PlanId): PlanTranslations => ({
		name: tp(`plans.${id}.name`),
		description: tp(`plans.${id}.description`),
		priceSuffix: tp(`plans.${id}.priceSuffix`),
		yearlyPriceSuffix: tp(`plans.${id}.yearlyPriceSuffix`),
		featureLabels: tp.raw(`plans.${id}.featureLabels`) as Record<
			string,
			string
		>,
		ctaLabel:
			checkoutLoading === id
				? tp("choosePlan.redirecting")
				: activePlanId === id
					? t("organizations.settings.billingCurrent")
					: tp(`plans.${id}.ctaLabel`),
	});

	const tiers = buildPricingTiers({
		audience: "saas",
		t: resolve,
		onCtaClick: checkout,
		loadingId: checkoutLoading,
		allDisabled: checkoutLoading !== null,
	});

	const tiersWithCurrent = tiers.map((tier) => ({
		...tier,
		disabled:
			tier.disabled ||
			(activePlanId === tier.id && tier.id !== "free") ||
			(tier.id === "free" && (!activeSub || activePlanId === "free")),
		onCtaClick: activePlanId === tier.id ? undefined : tier.onCtaClick,
	}));

	return (
		<div className="space-y-6">
			<Card>
				<CardContent className="space-y-4 p-6 md:p-8">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<CreditCard className="size-5 text-muted-foreground" />
							<div>
								<p className="font-medium text-sm">
									{activeSub
										? tp("planInterval", {
												plan: tp(`plans.${activePlanId}.name`),
												interval: tp("choosePlan.monthly"),
											})
										: t("organizations.settings.billingNoPlan")}
								</p>
							</div>
						</div>
						{activeSub ? (
							<Badge variant="secondary" className="gap-1.5">
								{t("organizations.settings.billingCurrentPlan")}
							</Badge>
						) : (
							<Badge variant="outline">{tp("plans.free.name")}</Badge>
						)}
					</div>

					{activeSub && (
						<div className="flex items-center justify-between gap-4 rounded-lg border p-4">
							<div>
								<p className="font-medium text-sm">
									{t("organizations.settings.billingManagePortal")}
								</p>
								<p className="text-muted-foreground text-xs">
									{t("organizations.settings.billingPortalHint")}
								</p>
							</div>
							<Button variant="outline" size="sm" onClick={openPortal}>
								<ExternalLink className="size-4" />
								{t("organizations.settings.billingManagePortal")}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}

			<PricingCompact
				tiers={tiersWithCurrent}
				popularLabel={tp("choosePlan.popular")}
				monthlyLabel={tp("choosePlan.monthly")}
				yearlyLabel={tp("choosePlan.yearly")}
				yearlyBadge={tp("choosePlan.yearlyBadge")}
			/>
		</div>
	);
}
