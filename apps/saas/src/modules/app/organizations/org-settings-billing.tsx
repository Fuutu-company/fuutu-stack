"use client";

import { authClient } from "@fuutu/auth/client";
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

const log = createLogger({ scope: "org-billing" });

type FullOrg = {
	id: string;
	name: string;
	slug: string;
};

type PolarSubscription = {
	id: string;
	status: string;
	productId: string;
	productName?: string;
	amount?: number;
	currency?: string;
	recurringInterval?: string;
	currentPeriodStart?: Date;
	currentPeriodEnd?: Date;
	cancelAtPeriodEnd?: boolean;
};

export function OrgSettingsBilling({
	slug,
	polarEnabled,
	productIds,
}: {
	slug: string;
	polarEnabled: boolean;
	/** Maps plan IDs to their provider-side product IDs (env-backed). */
	productIds: Partial<Record<PlanId, string>>;
}) {
	const t = useTranslations();
	const tp = useTranslations("payments");
	const { data: activeOrg } = authClient.useActiveOrganization();
	const [org, setOrg] = useState<FullOrg | null>(null);
	const [subscriptions, setSubscriptions] = useState<PolarSubscription[]>([]);
	const [loading, setLoading] = useState(true);
	const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
			const data = res.data as FullOrg | null;
			if (data) {
				setOrg(data);
				// Fetch subscriptions for this org via referenceId.
				// Only attempt when Polar is configured server-side to avoid 404s.
				if (
					polarEnabled &&
					typeof authClient.customer?.subscriptions?.list === "function"
				) {
					try {
						const subRes = await authClient.customer.subscriptions.list({
							query: {
								active: true,
								referenceId: data.id,
							},
						});
						if (subRes?.data?.result?.items) {
							// Polar SDK 0.49+ returns a PageIterator — first page's
							// items are in `.result.items`. Active subs for this org
							// fit in one page. Better Auth returns a superset of
							// PolarSubscription — narrowing is safe.
							setSubscriptions(subRes.data.result.items as PolarSubscription[]);
						}
					} catch (err) {
						// Subscriptions endpoint may not be available in all envs
						log.warn("subscriptions list failed", { err });
					}
				}
			}
		} finally {
			setLoading(false);
		}
	}, [slug, polarEnabled]);

	useEffect(() => {
		void load();
	}, [load]);

	const activeSub = subscriptions.find((s) => s.status === "active");
	// Map the active subscription's provider productId to a plan ID by iterating
	// configured plans. Product IDs are env-backed and injected via the
	// `productIds` prop. Plans without a productId (free, custom billing) are
	// skipped. Fallback: free.
	const activePlanId: PlanId = (() => {
		if (!activeSub?.productId) return "free";
		for (const id of Object.keys(PLANS) as PlanId[]) {
			const planProductId = productIds[id];
			if (planProductId && planProductId === activeSub.productId) {
				return id;
			}
		}
		return "free";
	})();
	const intervalLabel =
		activeSub?.recurringInterval === "year"
			? tp("choosePlan.yearly")
			: tp("choosePlan.monthly");

	async function checkout(planId: PlanId) {
		if (!org) return;
		setCheckoutLoading(planId);
		setError(null);
		try {
			if (!polarEnabled || typeof authClient.checkout !== "function") {
				setError(tp("choosePlan.unavailable"));
				return;
			}
			const res = await authClient.checkout({
				products: [planId],
				referenceId: org.id,
			});
			if (res?.error) {
				log.error("checkout error", { err: res.error.message });
				setError(tp("choosePlan.error"));
			}
		} catch (e) {
			log.error("checkout failed", { err: e });
			setError(tp("choosePlan.error"));
		} finally {
			setCheckoutLoading(null);
		}
	}

	async function openPortal() {
		if (polarEnabled && typeof authClient.customer?.portal === "function") {
			try {
				await authClient.customer.portal();
			} catch (err) {
				// Portal may not be configured
				log.warn("portal failed", { err });
			}
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
												interval: intervalLabel,
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
