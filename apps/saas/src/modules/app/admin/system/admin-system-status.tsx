"use client";

import { Badge, Button, Card, CardContent, Skeleton } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { CircleCheck, CircleDashed, CircleX, RefreshCw } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";
import type { AdminSystemStatusData } from "./types";

const SUCCESS = "border-transparent bg-success text-success-foreground";
const WARNING = "border-transparent bg-warning text-warning-foreground";

const th =
	"whitespace-nowrap px-4 py-3 text-left font-semibold text-muted-foreground text-xs";

function SectionCard({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="space-y-4 p-6">
				<div className="space-y-1">
					<h3 className="font-semibold text-sm">{title}</h3>
					{description ? (
						<p className="text-muted-foreground text-sm">{description}</p>
					) : null}
				</div>
				{children}
			</CardContent>
		</Card>
	);
}

function DatabaseCard({ data }: { data: AdminSystemStatusData }) {
	const t = useTranslations("admin.system.database");
	const { ok, latencyMs } = data.database;
	return (
		<SectionCard title={t("title")}>
			<dl className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1">
					<dt className="font-semibold text-muted-foreground text-xs">
						{t("status")}
					</dt>
					<dd>
						{ok ? (
							<Badge className={SUCCESS}>
								<CircleCheck aria-hidden="true" />
								{t("ok")}
							</Badge>
						) : (
							<Badge variant="destructive">
								<CircleX aria-hidden="true" />
								{t("down")}
							</Badge>
						)}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-semibold text-muted-foreground text-xs">
						{t("latency")}
					</dt>
					<dd className="text-sm" data-volatile>
						{t("latencyValue", { ms: latencyMs })}
					</dd>
				</div>
			</dl>
		</SectionCard>
	);
}

function VersionsCard({ data }: { data: AdminSystemStatusData }) {
	const t = useTranslations("admin.system.versions");
	return (
		<SectionCard title={t("title")}>
			<dl className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1">
					<dt className="font-semibold text-muted-foreground text-xs">
						{t("app")}
					</dt>
					<dd className="font-mono text-sm" data-volatile>
						{data.versions.app}
					</dd>
				</div>
				<div className="space-y-1">
					<dt className="font-semibold text-muted-foreground text-xs">
						{t("kit")}
					</dt>
					<dd className="font-mono text-sm" data-volatile>
						{data.versions.kit}
					</dd>
				</div>
			</dl>
		</SectionCard>
	);
}

function ProvidersCard({ data }: { data: AdminSystemStatusData }) {
	const t = useTranslations("admin.system.providers");
	return (
		<SectionCard title={t("title")} description={t("description")}>
			<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{data.providers.map((p) => (
					<li
						key={p.domain}
						className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
					>
						<span className="min-w-0 space-y-1">
							<span className="block font-semibold text-muted-foreground text-xs">
								{t(`domain.${p.domain}`)}
							</span>
							<span className="block truncate font-mono text-sm">
								{p.provider}
							</span>
						</span>
						<span data-volatile>
							{p.configured ? (
								<Badge className={SUCCESS}>
									<CircleCheck aria-hidden="true" />
									{t("configured")}
								</Badge>
							) : (
								<Badge className={WARNING}>
									<CircleDashed aria-hidden="true" />
									{t("notConfigured")}
								</Badge>
							)}
						</span>
					</li>
				))}
			</ul>
		</SectionCard>
	);
}

function CronStatus({ status }: { status: string | null }) {
	const t = useTranslations("admin.system.cron");
	if (status === null) {
		return (
			<span className="text-muted-foreground text-xs">{t("neverRun")}</span>
		);
	}
	const label = t.has(`statusValue.${status}`)
		? t(`statusValue.${status}`)
		: status;
	if (status === "success") return <Badge className={SUCCESS}>{label}</Badge>;
	if (status === "error") return <Badge variant="destructive">{label}</Badge>;
	if (status === "running") return <Badge variant="secondary">{label}</Badge>;
	return <Badge variant="outline">{label}</Badge>;
}

function CronCard({ data }: { data: AdminSystemStatusData }) {
	const t = useTranslations("admin.system.cron");
	const format = useFormatter();
	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="space-y-4 p-6">
				<div className="space-y-1">
					<h3 className="font-semibold text-sm">{t("title")}</h3>
					<p className="text-muted-foreground text-sm">{t("description")}</p>
				</div>
				{data.cron.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("empty")}</p>
				) : (
					<div className="-mx-6 -mb-6 overflow-x-auto border-t">
						<table className="w-full text-sm">
							<thead className="bg-muted/50">
								<tr>
									<th scope="col" className={th}>
										{t("job")}
									</th>
									<th scope="col" className={th}>
										{t("schedule")}
									</th>
									<th scope="col" className={th}>
										{t("lastRun")}
									</th>
									<th scope="col" className={th}>
										{t("status")}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{data.cron.map((job) => (
									<tr key={job.key}>
										<td className="px-4 py-3">
											<span className="font-mono text-xs">{job.key}</span>
											{job.enabled ? null : (
												<Badge variant="outline" className="ml-2">
													{t("disabled")}
												</Badge>
											)}
										</td>
										<td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground text-xs">
											{job.schedule}
										</td>
										<td
											className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
											data-volatile
										>
											{job.lastRunAt
												? format.dateTime(job.lastRunAt, {
														dateStyle: "medium",
														timeStyle: "short",
													})
												: t("neverRun")}
										</td>
										<td className="px-4 py-3" data-volatile>
											<CronStatus status={job.lastStatus} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

function FeaturesCard({ data }: { data: AdminSystemStatusData }) {
	const t = useTranslations("admin.system.features");
	return (
		<SectionCard title={t("title")} description={t("description")}>
			<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{data.features.map((feature) => (
					<li
						key={feature.key}
						className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
					>
						<span className="min-w-0 truncate font-mono text-xs">
							{feature.key}
						</span>
						{typeof feature.value === "boolean" ? (
							feature.value ? (
								<Badge className={SUCCESS}>
									<CircleCheck aria-hidden="true" />
									{t("on")}
								</Badge>
							) : (
								<Badge variant="outline">
									<CircleX aria-hidden="true" />
									{t("off")}
								</Badge>
							)
						) : (
							<Badge variant="secondary">{feature.value}</Badge>
						)}
					</li>
				))}
			</ul>
		</SectionCard>
	);
}

export function AdminSystemStatus() {
	const t = useTranslations("admin.system");
	const query = useQuery(orpc.admin.system.status.queryOptions());

	if (query.isError) {
		return (
			<Card>
				<CardContent className="flex flex-col items-center gap-4 py-8 text-center">
					<p role="alert" className="text-muted-foreground">
						{t("loadError")}
					</p>
					<Button variant="outline" onClick={() => void query.refetch()}>
						{t("retry")}
					</Button>
				</CardContent>
			</Card>
		);
	}

	const data = query.data;
	if (!data) {
		return (
			<div className="space-y-6" aria-busy="true">
				<Skeleton className="h-28 w-full" />
				<Skeleton className="h-72 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-end">
				<Button
					variant="outline"
					size="sm"
					disabled={query.isFetching}
					onClick={() => void query.refetch()}
				>
					<RefreshCw aria-hidden="true" />
					{t("refresh")}
				</Button>
			</div>
			<div className="grid gap-6 md:grid-cols-2">
				<DatabaseCard data={data} />
				<VersionsCard data={data} />
			</div>
			<ProvidersCard data={data} />
			<CronCard data={data} />
			<FeaturesCard data={data} />
		</div>
	);
}
