"use client";

import {
	AREA_CLASSES,
	AREAS,
	AreaBadge,
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@fuutu/ui";
import { buildStackedBars } from "@fuutu/ui/stacked-bars";
import { useFormatter, useTranslations } from "next-intl";
import type { DashboardOverviewData } from "../lib/usage";

const GRID_LINES = [0, 1, 2, 3];

const toDate = (isoDay: string) => new Date(`${isoDay}T00:00:00Z`);

export function ActivityChart({
	days,
}: {
	days: DashboardOverviewData["activity"]["days"];
}) {
	const t = useTranslations("dashboard");
	const format = useFormatter();
	const dayLabel = (isoDay: string) =>
		format.dateTime(toDate(isoDay), {
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		});

	const chart = buildStackedBars(days, AREAS);
	const peakDay = chart.peakIndex >= 0 ? days[chart.peakIndex] : undefined;
	const firstDay = days[0];
	const summary = peakDay
		? t("chart.summary", {
				total: chart.total,
				date: dayLabel(peakDay.date),
			})
		: t("chart.summaryEmpty");

	const areaTotals = AREAS.map((area) => ({
		area,
		total: days.reduce((sum, d) => sum + d[area], 0),
	}));

	return (
		<Card
			className="lg:col-span-8"
			data-testid="activity-chart"
			data-volatile=""
		>
			<figure className="m-0 flex flex-col gap-6">
				<CardHeader>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<CardTitle className="text-base">
							<h2>{t("chart.title")}</h2>
						</CardTitle>
						<span className="font-semibold text-muted-foreground text-xs">
							{t("chart.range")}
						</span>
					</div>
					<ul className="mt-1 flex flex-wrap gap-2">
						{areaTotals.map(({ area, total: areaTotal }) => (
							<li key={area}>
								<AreaBadge area={area} className="h-7 gap-1.5 text-xs">
									<span
										aria-hidden="true"
										className={`size-2 rounded-full ${AREA_CLASSES[area].dot}`}
									/>
									{t("chart.legendItem", {
										area: t(`areas.${area}`),
										total: areaTotal,
									})}
								</AreaBadge>
							</li>
						))}
					</ul>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					<div className="relative h-60">
						<div
							aria-hidden="true"
							className="absolute inset-0 flex flex-col justify-between"
						>
							{GRID_LINES.map((line) => (
								<div
									key={line}
									className={
										line === GRID_LINES.length - 1
											? "border-border border-t"
											: "border-border border-t border-dashed"
									}
								/>
							))}
						</div>
						<div
							role="img"
							aria-label={summary}
							className="absolute inset-0 flex items-end gap-[3px]"
						>
							{chart.bars.map((bar, i) => {
								const day = days[i];
								return (
									<div
										key={day?.date ?? i}
										title={
											day
												? `${dayLabel(day.date)}: ${format.number(bar.total)}`
												: undefined
										}
										className="flex h-full flex-1 items-end"
									>
										<div
											className="flex w-full flex-col-reverse overflow-hidden rounded-t-md"
											style={{ height: `${bar.pct}%` }}
										>
											{bar.segments.map((segment) => (
												<div
													key={segment.key}
													className={`min-h-0.5 shadow-[0_-1.5px_0_var(--card)] ${AREA_CLASSES[segment.key].dot}`}
													style={{ flexGrow: segment.value, flexBasis: 0 }}
												/>
											))}
										</div>
									</div>
								);
							})}
						</div>
					</div>
					<div
						aria-hidden="true"
						className="flex justify-between font-semibold text-muted-foreground text-xs"
					>
						<span>{firstDay ? dayLabel(firstDay.date) : null}</span>
						<span>{t("chart.today")}</span>
					</div>
				</CardContent>
				<figcaption aria-hidden="true" className="sr-only">
					{summary}
				</figcaption>
			</figure>
		</Card>
	);
}
