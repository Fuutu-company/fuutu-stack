"use client";

import { config } from "@fuutu/config";
import { paymentsConfig } from "@fuutu/payments/config";
import { type Area, AreaTile } from "@fuutu/ui";
import { CreditCard, KeyRound, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
	ACCOUNT_SETTINGS_PATH,
	orgSettingsBase,
} from "../../components/nav-config";
import {
	creditTotals,
	type DashboardOverviewData,
	limitParams,
} from "../lib/usage";

function areaHrefs(orgSlug: string | null): Record<Area, string | null> {
	const orgsOn = config.features.organizationsMode !== "off";
	if (orgSlug) {
		const base = orgSettingsBase(orgSlug);
		return {
			users: `${base}/members`,
			billing:
				paymentsConfig.billingAttachedTo === "organization"
					? `${base}/billing`
					: `${ACCOUNT_SETTINGS_PATH}?tab=billing`,
			ai: paymentsConfig.creditsEnabled ? `${base}/credits` : null,
			api: `${base}/api-keys`,
		};
	}
	return {
		users: orgsOn ? "/organizations" : `${ACCOUNT_SETTINGS_PATH}?tab=profile`,
		billing:
			paymentsConfig.billingAttachedTo === "user"
				? `${ACCOUNT_SETTINGS_PATH}?tab=billing`
				: orgsOn
					? "/organizations"
					: "/choose-plan",
		ai: paymentsConfig.creditsEnabled
			? `${ACCOUNT_SETTINGS_PATH}?tab=credits`
			: null,
		api: `${ACCOUNT_SETTINGS_PATH}/api-keys`,
	};
}

function TileLink({
	href,
	children,
}: {
	href: string | null;
	children: ReactNode;
}) {
	if (!href) return children;
	return (
		<Link
			href={href}
			className="group block rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>[data-slot=area-tile]]:h-full [&>[data-slot=area-tile]]:transition-shadow [&>[data-slot=area-tile]]:group-hover:shadow-md"
		>
			{children}
		</Link>
	);
}

export function AreaKpis({
	data,
	orgSlug,
}: {
	data: DashboardOverviewData;
	orgSlug: string | null;
}) {
	const hrefs = areaHrefs(orgSlug);
	const t = useTranslations("dashboard");
	const tp = useTranslations("payments");
	const format = useFormatter();
	const compact = (n: number) =>
		format.number(n, { notation: "compact", maximumFractionDigits: 1 });
	const noAccess = t("noAccess");
	const planName = tp(`plans.${data.planId}.name`);

	const { users, billing, credits, api } = data;
	const usersKind = users.kind === "members" ? "members" : "organizations";

	let aiValue: string = noAccess;
	let aiDescription: string | undefined;
	if (credits) {
		const totals = creditTotals(credits);
		if (totals.hasBalance && totals.total > 0) {
			aiValue = compact(credits.remaining);
			aiDescription = t("kpi.ai.left", {
				pct: Math.min(
					100,
					Math.round((credits.remaining / totals.total) * 100),
				),
				total: compact(totals.total),
			});
		} else {
			aiValue = compact(totals.total);
			aiDescription = t("kpi.ai.included");
		}
	}

	let billingDescription: string | undefined;
	if (billing) {
		billingDescription = billing.renewsAt
			? t("kpi.billing.renews", {
					date: format.dateTime(new Date(billing.renewsAt), {
						dateStyle: "medium",
					}),
				})
			: data.scope === "user"
				? t("kpi.billing.livesOnOrgs")
				: t("kpi.billing.noRenewal");
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			<TileLink href={hrefs.users}>
				<AreaTile
					aligned
					area="users"
					title={t(`kpi.${usersKind}.title`)}
					icon={<Users />}
					value={format.number(users.count)}
					description={t(
						`kpi.${usersKind}.description`,
						limitParams(users.limit),
					)}
				/>
			</TileLink>
			<TileLink href={hrefs.billing}>
				<AreaTile
					aligned
					area="billing"
					title={t("kpi.billing.title")}
					icon={<CreditCard />}
					value={
						billing ? (
							<span className="text-3xl">{planName}</span>
						) : (
							<span className="font-bold text-base">{noAccess}</span>
						)
					}
					description={billingDescription}
				/>
			</TileLink>
			<TileLink href={hrefs.ai}>
				<AreaTile
					aligned
					area="ai"
					title={t("kpi.ai.title")}
					icon={<Sparkles />}
					value={
						credits ? (
							aiValue
						) : (
							<span className="font-bold text-base">{noAccess}</span>
						)
					}
					description={aiDescription}
				/>
			</TileLink>
			<TileLink href={hrefs.api}>
				<AreaTile
					aligned
					area="api"
					title={t("kpi.api.title")}
					icon={<KeyRound />}
					value={
						api ? (
							format.number(api.apiKeys)
						) : (
							<span className="font-bold text-base">{noAccess}</span>
						)
					}
					description={
						api
							? api.webhooks !== null
								? t("kpi.api.webhooks", { count: api.webhooks })
								: t("kpi.api.ofLimit", limitParams(api.apiKeyLimit))
							: undefined
					}
				/>
			</TileLink>
		</div>
	);
}
