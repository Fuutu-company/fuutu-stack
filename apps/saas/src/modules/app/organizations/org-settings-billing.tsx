"use client";

import { createLogger } from "@fuutu/logs";
import {
	BILLING_CURRENCY,
	type BillingInterval,
	PLANS,
	type Plan,
	type PlanId,
} from "@fuutu/payments/config";
import {
	buildPricingTiers,
	getFreePlanId,
	getSeatPlan,
	type PlanTranslations,
} from "@fuutu/payments/plans";
import {
	AreaIcon,
	Badge,
	Button,
	Card,
	CardContent,
	PageHeader,
	PricingCompact,
	SeatSelector,
} from "@fuutu/ui";
import { CreditCard, ExternalLink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { isPaymentsUnavailable } from "@/lib/api-error";
import { orpc } from "@/utils/orpc";
import {
	useFullOrganization,
	useInvalidateOrganization,
} from "./use-full-organization";

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

/** Provider-side price IDs per plan, keyed by billing interval. */
type PlanPriceIds = { monthly?: string; yearly?: string };

export function OrgSettingsBilling({
	slug,
	paymentsEnabled,
	productIds: priceIds,
}: {
	slug: string;
	paymentsEnabled: boolean;
	/** Maps plan IDs to their provider-side price IDs (env-backed). */
	productIds: Partial<Record<PlanId, PlanPriceIds>>;
}) {
	const t = useTranslations();
	const tp = useTranslations("payments");
	const locale = useLocale();
	const orgQuery = useFullOrganization(slug);
	const invalidateOrganization = useInvalidateOrganization();
	// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
	const org = (orgQuery.data ?? null) as FullOrg | null;
	const orgId = org?.id;
	const [activeSub, setActiveSub] = useState<ActiveSubscription | null>(null);
	const [subLoading, setSubLoading] = useState(paymentsEnabled);
	const loading = orgQuery.isPending || subLoading;
	const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [seatCount, setSeatCount] = useState(1);

	// The seat-priced plan (first `seatBased` plan) prices the selector.
	const seatPlan = getSeatPlan()?.plan;
	// Orgs without a matching subscription are on the free plan.
	const freePlanId = getFreePlanId();

	const loadSubscription = useCallback(async () => {
		if (!orgId || !paymentsEnabled) {
			setSubLoading(false);
			return;
		}
		setSubLoading(true);
		try {
			// Active subscription for this org from the Purchase table
			const sub = await orpc.payments.subscription.active.call({
				organizationId: orgId,
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
		} finally {
			setSubLoading(false);
			// Returning from checkout/portal lands here — refresh the switcher badge.
			void invalidateOrganization(slug, { plansOnly: true });
		}
	}, [orgId, paymentsEnabled, slug, invalidateOrganization]);

	useEffect(() => {
		void loadSubscription();
	}, [loadSubscription]);

	// Map the active subscription's provider productId to a plan ID.
	// A yearly subscription carries the yearly price ID — check both so a
	// yearly sub resolves to its plan (and the correct interval label).
	const { activePlanId, activeInterval } = ((): {
		activePlanId: PlanId | undefined;
		activeInterval: BillingInterval;
	} => {
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
		return { activePlanId: freePlanId, activeInterval: "month" };
	})();

	async function checkout(planId: PlanId, interval?: BillingInterval) {
		if (!org) return;
		setCheckoutLoading(planId);
		setError(null);
		try {
			const plan: Plan = PLANS[planId];
			const seats = plan.seatBased ? seatCount : undefined;
			const result = await orpc.payments.checkout.create.call({
				planId,
				interval,
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
			setError(
				isPaymentsUnavailable(e)
					? tp("choosePlan.unavailable")
					: tp("choosePlan.error"),
			);
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
		seatCountFor: (id) =>
			(PLANS[id] as Plan).seatBased ? seatCount : undefined,
	});

	// Mark current plan as disabled (can't "upgrade" to current plan)
	const tiersWithCurrent = tiers.map((tier) => ({
		...tier,
		disabled:
			tier.disabled ||
			(activePlanId === tier.id && tier.id !== freePlanId) ||
			(tier.id === freePlanId && (!activeSub || activePlanId === freePlanId)),
		onCtaClick: activePlanId === tier.id ? undefined : tier.onCtaClick,
	}));

	const seatCurrency = seatPlan?.currency ?? BILLING_CURRENCY;
	const currencySymbol =
		new Intl.NumberFormat(locale, {
			style: "currency",
			currency: seatCurrency,
		})
			.formatToParts(0)
			.find((part) => part.type === "currency")?.value ?? seatCurrency;

	return (
		<div className="space-y-6">
			<PageHeader
				variant="compact"
				title={t("organizations.settings.billing")}
			/>

			{/* Current plan summary */}
			<Card className="py-0">
				<CardContent className="space-y-4 p-6 md:p-8">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<div className="flex min-w-0 items-center gap-3">
							<AreaIcon area="billing">
								<CreditCard />
							</AreaIcon>
							<div className="min-w-0">
								<p className="font-medium text-sm">{org.name}</p>
								<p className="text-muted-foreground text-xs">
									{activeSub && activePlanId
										? tp("planInterval", {
												plan: tp(`plans.${activePlanId}.name`),
												interval: tp(
													activeInterval === "year"
														? "choosePlan.yearly"
														: "choosePlan.monthly",
												),
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
							freePlanId && (
								<Badge variant="outline">
									{tp(`plans.${freePlanId}.name`)}
								</Badge>
							)
						)}
					</div>

					{activeSub && (
						<div className="flex flex-col gap-3 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
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
				<h2 className="font-bold font-heading text-lg tracking-heading">
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

			{seatPlan && (
				<SeatSelector
					seatCount={seatCount}
					onChange={setSeatCount}
					pricePerSeat={seatPlan.amount}
					currency={seatPlan.currency}
					currencySymbol={currencySymbol}
					locale={locale}
					interval={seatPlan.interval}
					translations={{
						title: tp("seatSelector.title"),
						seat: tp("seatSelector.seat"),
						seats: tp("seatSelector.seats"),
						perMonth: tp("seatSelector.perMonth"),
						perYear: tp("seatSelector.perYear"),
						description: tp("seatSelector.description"),
						decrease: tp("seatSelector.decrease"),
						increase: tp("seatSelector.increase"),
						seatCount: tp("seatSelector.count"),
					}}
				/>
			)}

			<PricingCompact
				tiers={tiersWithCurrent}
				popularLabel={tp("choosePlan.popular")}
				monthlyLabel={tp("choosePlan.monthly")}
				yearlyLabel={tp("choosePlan.yearly")}
				yearlyBadge={tp("choosePlan.yearlyBadge")}
				seatLabel={(n) =>
					`${n} ${n === 1 ? tp("seatSelector.seat") : tp("seatSelector.seats")}`
				}
			/>
		</div>
	);
}
