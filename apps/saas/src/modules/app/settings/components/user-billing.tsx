"use client";

import { createLogger } from "@fuutu/logs";
import {
	type BillingInterval,
	PLANS,
	type PlanId,
} from "@fuutu/payments/config";
import {
	buildPricingTiers,
	type PlanTranslations,
} from "@fuutu/payments/plans";
import {
	AreaIcon,
	Badge,
	Button,
	Card,
	CardContent,
	PricingCompact,
} from "@fuutu/ui";
import { CreditCard, ExternalLink } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { paymentsErrorKey } from "@/lib/api-error";
import { useImpersonating } from "@/lib/use-impersonating";
import { ImpersonationNotice } from "@/modules/app/components/impersonation-notice";
import { orpc } from "@/utils/orpc";

const log = createLogger({ scope: "user-billing" });

type ActiveSubscription = {
	id: string;
	status: string;
	productId: string | null;
	/** Resolved on the server — covers no-trial products too. */
	planId: PlanId | null;
	interval: BillingInterval | null;
	currentPeriodEnd?: Date | null;
};

/** An active one-time plan purchase (lifetime access). */
type LifetimePurchase = {
	planId: PlanId | null;
	purchasedAt: Date;
	/** The provider portal holds its receipts. */
	receipts: boolean;
};

/** Provider-side price IDs per plan, keyed by billing interval. */
type PlanPriceIds = { monthly?: string; yearly?: string };

export function UserSettingsBilling({
	priceIds,
}: {
	priceIds: Partial<Record<PlanId, PlanPriceIds>>;
}) {
	const t = useTranslations();
	const tp = useTranslations("payments");
	const format = useFormatter();
	const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null);
	const [lifetime, setLifetime] = useState<LifetimePurchase | null>(null);
	const [loading, setLoading] = useState(true);
	const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Checkout and portal refuse impersonation sessions (denyImpersonation).
	const impersonating = useImpersonating();

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const [sub, oneTime] = await Promise.all([
				orpc.payments.subscription.active.call({}),
				orpc.payments.subscription.lifetime.call({}),
			]);
			setLifetime(
				oneTime
					? {
							planId: oneTime.planId,
							purchasedAt: new Date(oneTime.purchasedAt),
							receipts: oneTime.receipts,
						}
					: null,
			);
			if (sub) {
				setActiveSub({
					id: sub.id,
					status: sub.status,
					productId: sub.productId ?? null,
					planId: sub.planId,
					interval: sub.interval,
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

	// A yearly subscription carries the yearly price ID — check both so a
	// yearly sub resolves to its plan (and the correct interval label).
	const { activePlanId, activeInterval } = ((): {
		activePlanId: PlanId;
		activeInterval: BillingInterval;
	} => {
		if (activeSub?.planId) {
			return {
				activePlanId: activeSub.planId,
				activeInterval: activeSub.interval ?? "month",
			};
		}
		if (activeSub?.productId) {
			for (const id of Object.keys(PLANS) as PlanId[]) {
				const ids = priceIds[id];
				if (ids?.yearly === activeSub.productId) {
					return { activePlanId: id, activeInterval: "year" };
				}
				if (ids?.monthly === activeSub.productId) {
					return { activePlanId: id, activeInterval: "month" };
				}
			}
		}
		// Lifetime access (one-time plan purchase) when no subscription.
		if (lifetime?.planId) {
			return { activePlanId: lifetime.planId, activeInterval: "month" };
		}
		return { activePlanId: "free", activeInterval: "month" };
	})();
	// Only a lifetime purchase stands for the plan when no subscription does.
	const lifetimePlan = !activeSub && lifetime?.planId ? lifetime : null;
	const hasPlan = Boolean(activeSub || lifetimePlan);

	async function checkout(planId: PlanId, interval?: BillingInterval) {
		setCheckoutLoading(planId);
		setError(null);
		try {
			const result = await orpc.payments.checkout.create.call({
				planId,
				interval,
				successUrl: "/settings?tab=billing",
				cancelUrl: "/settings?tab=billing",
			});
			if (result?.url) {
				window.location.href = result.url;
			}
		} catch (e) {
			log.error("checkout failed", { err: e });
			setError(tp(paymentsErrorKey(e) ?? "choosePlan.error"));
		} finally {
			setCheckoutLoading(null);
		}
	}

	async function openPortal() {
		setError(null);
		try {
			const result = await orpc.payments.portal.open.call({
				returnUrl: "/settings?tab=billing",
			});
			if (result?.url) {
				window.location.href = result.url;
			}
		} catch (err) {
			log.warn("portal failed", { err });
			setError(tp(paymentsErrorKey(err) ?? "errors.portal"));
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
		allDisabled: checkoutLoading !== null || impersonating,
	});

	const tiersWithCurrent = tiers.map((tier) => ({
		...tier,
		disabled:
			tier.disabled ||
			(activePlanId === tier.id && tier.id !== "free") ||
			(tier.id === "free" && (!hasPlan || activePlanId === "free")),
		onCtaClick: activePlanId === tier.id ? undefined : tier.onCtaClick,
	}));

	return (
		<div className="space-y-6">
			<Card className="py-0">
				<CardContent className="space-y-4 p-6 md:p-8">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="flex min-w-0 items-center gap-3">
							<AreaIcon area="billing">
								<CreditCard />
							</AreaIcon>
							<div className="min-w-0">
								<p className="font-medium text-sm">
									{activeSub
										? tp("planInterval", {
												plan: tp(`plans.${activePlanId}.name`),
												interval: tp(
													activeInterval === "year"
														? "choosePlan.yearly"
														: "choosePlan.monthly",
												),
											})
										: lifetimePlan
											? tp("lifetime.label", {
													plan: tp(`plans.${activePlanId}.name`),
												})
											: t("organizations.settings.billingNoPlan")}
								</p>
								{lifetimePlan ? (
									<p className="text-muted-foreground text-xs">
										{tp("lifetime.purchased", {
											date: format.dateTime(lifetimePlan.purchasedAt, {
												dateStyle: "medium",
											}),
										})}
									</p>
								) : null}
							</div>
						</div>
						{hasPlan ? (
							<Badge variant="secondary" className="gap-1.5">
								{t("organizations.settings.billingCurrentPlan")}
							</Badge>
						) : (
							<Badge variant="outline">{tp("plans.free.name")}</Badge>
						)}
					</div>

					{(activeSub || lifetimePlan?.receipts) && (
						<div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
							<div>
								<p className="font-medium text-sm">
									{activeSub
										? t("organizations.settings.billingManagePortal")
										: tp("lifetime.receipts")}
								</p>
								<p className="text-muted-foreground text-xs">
									{activeSub
										? t("organizations.settings.billingPortalHint")
										: tp("lifetime.receiptsHint")}
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={openPortal}
								disabled={impersonating}
							>
								<ExternalLink className="size-4" />
								{activeSub
									? t("organizations.settings.billingManagePortal")
									: tp("lifetime.receipts")}
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{impersonating && <ImpersonationNotice />}

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
