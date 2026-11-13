"use client";

import { usagePercent } from "@fuutu/payments/features";
import {
	AREA_CLASSES,
	type Area,
	AreaBadge,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Progress,
} from "@fuutu/ui";
import { useFormatter, useTranslations } from "next-intl";
import { creditTotals, type DashboardOverviewData } from "../lib/usage";

type Meter = {
	id: string;
	area: Area;
	label: string;
	used: number;
	limit: Parameters<typeof usagePercent>[1];
	compact?: boolean;
};

export function PlanUsage({ data }: { data: DashboardOverviewData }) {
	const t = useTranslations("dashboard");
	const tp = useTranslations("payments");
	const format = useFormatter();
	const planName = tp(`plans.${data.planId}.name`);
	const number = (n: number, compact?: boolean) =>
		compact
			? format.number(n, { notation: "compact", maximumFractionDigits: 1 })
			: format.number(n);

	const meters: Meter[] = [
		{
			id: "users",
			area: "users",
			label: t(
				data.users.kind === "members" ? "usage.members" : "usage.organizations",
			),
			used: data.users.count,
			limit: data.users.limit,
		},
	];
	if (data.api) {
		meters.push({
			id: "apiKeys",
			area: "api",
			label: t("usage.apiKeys"),
			used: data.api.apiKeys,
			limit: data.api.apiKeyLimit,
		});
		if (data.api.webhooks !== null) {
			meters.push({
				id: "webhooks",
				area: "api",
				label: t("usage.webhooks"),
				used: data.api.webhooks,
				limit: data.api.webhookLimit,
			});
		}
	}
	if (data.credits) {
		const totals = creditTotals(data.credits);
		meters.push({
			id: "ai",
			area: "ai",
			label: t("usage.ai"),
			used: totals.used,
			limit: totals.total > 0 ? totals.total : data.credits.included,
			compact: true,
		});
	}

	return (
		<Card className="lg:col-span-6" data-testid="plan-usage">
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<CardTitle className="text-base">
						<h2>{t("usage.title")}</h2>
					</CardTitle>
					<AreaBadge area="billing">{planName}</AreaBadge>
				</div>
			</CardHeader>
			<CardContent>
				<ul className="grid gap-5">
					{meters.map((meter) => {
						const usage = usagePercent(meter.used, meter.limit);
						return (
							<li key={meter.id} className="grid gap-2">
								<div className="flex items-baseline justify-between gap-3 font-bold text-sm">
									<span>{meter.label}</span>
									<span className="font-semibold text-muted-foreground tabular-nums">
										{usage.kind === "unlimited"
											? t("usage.unlimited")
											: usage.kind === "unavailable"
												? t("usage.unavailable", { plan: planName })
												: t("usage.ratio", {
														used: number(meter.used, meter.compact),
														limit: number(
															typeof meter.limit === "number" ? meter.limit : 0,
															meter.compact,
														),
													})}
									</span>
								</div>
								{usage.kind === "percent" ? (
									<Progress
										value={usage.value}
										aria-label={meter.label}
										className="h-3 bg-muted"
										indicatorClassName={`rounded-full ${AREA_CLASSES[meter.area].dot}`}
									/>
								) : null}
							</li>
						);
					})}
				</ul>
			</CardContent>
		</Card>
	);
}
