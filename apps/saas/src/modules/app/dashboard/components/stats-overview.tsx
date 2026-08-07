"use client";

import { i18nConfig } from "@fuutu/i18n/config";
import { PLAN_IDS } from "@fuutu/payments/config";
import { StatsCard } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { Activity, Globe, Layers, Tags } from "lucide-react";
import { useTranslations } from "next-intl";
import { SWAPPABLE_DOMAINS_COUNT } from "@/lib/api-stats";
import { orpc } from "@/utils/orpc";

export function StatsOverview() {
	const t = useTranslations("dashboard");
	const { data } = useQuery(orpc.activity.recent.queryOptions());
	const authEventCount = data?.items?.length ?? 0;

	const stats = [
		{
			title: t("stats.authEvents"),
			value: String(authEventCount),
			description: t("stats.authEventsDescription"),
			icon: Activity,
		},
		{
			title: t("stats.plansConfigured"),
			value: String(PLAN_IDS.length),
			description: t("stats.plansConfiguredDescription"),
			icon: Tags,
		},
		{
			title: t("stats.providersSwappable"),
			value: String(SWAPPABLE_DOMAINS_COUNT),
			description: t("stats.providersSwappableDescription"),
			icon: Layers,
		},
		{
			title: t("stats.localesShipped"),
			value: String(Object.keys(i18nConfig.locales).length),
			description: t("stats.localesShippedDescription"),
			icon: Globe,
		},
	];

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{stats.map((stat) => (
				<StatsCard
					key={stat.title}
					title={stat.title}
					value={stat.value}
					description={stat.description}
					icon={stat.icon}
				/>
			))}
		</div>
	);
}
