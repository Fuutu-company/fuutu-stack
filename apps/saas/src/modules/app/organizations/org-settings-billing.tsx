"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import { PLANS, type PlanId } from "@fuutu/payments/config";
import {
	buildPricingTiers,
	type PlanTranslations,
} from "@fuutu/payments/plans";
import {
	Badge,
	Button,
	Card,
	CardContent,
	PricingCompact,
	SeatSelector,
} from "@fuutu/ui";
import { CreditCard, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { orpc } from "@/utils/orpc";

const log = createLogger({ scope: "org-billing" });

type FullOrg = {
	id: string;
	name: string;
	slug: string;
};

type ActiveSubscription = {
	id: string;
	status: string;
	productId: string;
	currentPeriodEnd?: Date;
};

export function OrgSettingsBilling({
	slug,
	paymentsEnabled,
	productIds: priceIds,
}: {
	slug: string;
	paymentsEnabled: boolean;
	/** Maps plan IDs to their provider-side price IDs (env-backed). */
	productIds: Partial<Record<PlanId, string>>;
}) {
	const t = useTranslations();
	const tp = useTranslations("payments");
	const locale = useLocale();
	const { data: activeOrg } = authClient.useActiveOrganization();
	const [org, setOrg] = useState<FullOrg | null>(null);
	const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null);
	const [loading, setLoading] = useState(true);
	const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [seatCount, setSeatCount] = useState(1);

	// Check if any plan is seat-based
	const hasSeatBasedPlan = Object.values(PLANS).some((plan) => plan.seatBased);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			const data = res.data as FullOrg | null;
			if (data) {
				setOrg(data);
				// Fetch active subscription for this org from the Purchase table
				if (paymentsEnabled) {
					try {
						const sub = await orpc.payments.subscription.active.call({
							organizationId: data.id,
						});
						if (sub) {
							setActiveSub({
								id: sub.id,
								status: sub.status,
								productId: sub.productId ?? "",
								currentPeriodEnd: sub.currentPeriodEnd ?? undefined,
							});
						}
					} catch (err) {
						log.warn("subscription fetch failed", { err });
					}
				}
			}
		} finally {
			setLoading(false);
		}
	}, [slug, paymentsEnabled]);

	useEffect(() => {
		void load();
	}, [load]);

	// Map the active subscription's provider productId to a plan ID
	const activePlanId: PlanId = (() => {
		if (!activeSub?.productId) return "free";
		for (const id of Object.keys(PLANS) as PlanId[]) {
			const planProductId = priceIds[id];
			if (planProductId && planProductId === activeSub.productId) {
				return id;
			}
		}
		return "free";
	})();

	async function checkout(planId: PlanId) {
		if (!org) return;
		const priceId = priceIds[planId];
		if (!priceId) {
			setError(tp("choosePlan.unavailable"));
			return;
		}
		setCheckoutLoading(planId);
		setError(null);
		try {
			const plan = PLANS[planId];
			const seats = plan.seatBased ? seatCount : undefined;
			const result = await orpc.payments.checkout.create.call({
				priceId,
				organizationId: org.id,
				successUrl: `/organizations/${slug}/settings/billing`,
				cancelUrl: `/organizations/${slug}/settings/billing`,
				seats,
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
		if (!org) return;
		try {
			const result = await orpc.payments.portal.open.call({
				organizationId: org.id,
				returnUrl: `/organizations/${slug}/settings/billing`,
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
	if (!org) {
		return <p className="text-muted-foreground text-sm">{t("common.error")}</p>;
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
		seatCountFor: (id) => (PLANS[id].seatBased ? seatCount : undefined),
	});

	// Mark current plan as disabled (can't "upgrade" to current plan)
	const tiersWithCurrent = tiers.map((tier) => ({
		...tier,
		disabled:
			tier.disabled ||
			(activePlanId === tier.id && tier.id !== "free") ||
			(tier.id === "free" && (!activeSub || activePlanId === "free")),
		onCtaClick: activePlanId === tier.id ? undefined : tier.onCtaClick,
	}));

	// Get the Pro plan for seat selector (it's the seat-based plan)
	const proPlan = PLANS.pro;
	const currencySymbol =
		new Intl.NumberFormat(locale, {
			style: "currency",
			currency: proPlan.currency,
		})
			.formatToParts(0)
			.find((part) => part.type === "currency")?.value ?? proPlan.currency;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-3xl tracking-tight">
					{t("organizations.settings.billing")}
				</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					{t("organizations.settings.billingDescription")}
				</p>
			</div>

			{/* Current plan summary */}
			<Card>
				<CardContent className="space-y-4 p-6 md:p-8">
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-3">
							<CreditCard className="size-5 text-muted-foreground" />
							<div>
								<p className="font-medium text-sm">
									{activeOrg?.name ?? org.name}
								</p>
								<p className="text-muted-foreground text-xs">
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

			{/* Plan selection */}
			<div>
				<h2 className="font-semibold text-lg tracking-tight">
					{t("organizations.settings.billingChoosePlan")}
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					{t("organizations.settings.billingChoosePlanHint")}
				</p>
			</div>

			{error && (
				<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
					{error}
				</div>
			)}

			{hasSeatBasedPlan && proPlan && (
				<SeatSelector
					seatCount={seatCount}
					onChange={setSeatCount}
					pricePerSeat={proPlan.amount}
					currency={proPlan.currency}
					currencySymbol={currencySymbol}
					interval={proPlan.interval}
					translations={{
						title: tp("seatSelector.title"),
						seat: tp("seatSelector.seat"),
						seats: tp("seatSelector.seats"),
						perMonth: tp("seatSelector.perMonth"),
						perYear: tp("seatSelector.perYear"),
						description: tp("seatSelector.description"),
					}}
				/>
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
