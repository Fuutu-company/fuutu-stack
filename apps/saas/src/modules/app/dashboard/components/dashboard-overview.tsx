"use client";

import { useFullOrganization } from "@app/organizations/use-full-organization";
import { config } from "@fuutu/config";
import {
	hasOrgPermission,
	ORG_POLICY,
	OrgAccessControl,
	PERMISSIONS,
	toOrgRole,
} from "@fuutu/rbac";
import { Button, Card, PageHeader, Skeleton } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { CloudAlert, RotateCw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { orpc } from "@/utils/orpc";
import { ActivityChart } from "./activity-chart";
import { AreaKpis } from "./area-kpis";
import { HappeningNow } from "./happening-now";
import { MakeItYours } from "./make-it-yours";
import { PlanUsage } from "./plan-usage";

const ac = new OrgAccessControl(ORG_POLICY);

type Member = { userId: string; role: string };

export interface DashboardOverviewProps {
	/** First name for the greeting; null falls back to a plain welcome. */
	firstName: string | null;
	userId: string;
	/** Set on the organization dashboard; null for the personal one. */
	orgSlug: string | null;
}

export function DashboardOverview({
	firstName,
	userId,
	orgSlug,
}: DashboardOverviewProps) {
	const t = useTranslations("dashboard");
	const tp = useTranslations("payments");
	const orgQuery = useFullOrganization(orgSlug);
	const org = orgQuery.data ?? null;
	const organizationId = org?.id;

	const overview = useQuery({
		...orpc.dashboard.overview.queryOptions({
			input: organizationId ? { organizationId } : {},
		}),
		enabled: !orgSlug || Boolean(organizationId),
	});
	const data = overview.data;

	const memberRole = (org?.members as Member[] | undefined)?.find(
		(m) => m.userId === userId,
	)?.role;
	const canInvite = memberRole
		? hasOrgPermission(ac, toOrgRole(memberRole), PERMISSIONS.INVITE_MEMBER)
		: false;

	const scopeLabel = org?.name ?? t("scopePersonal");
	const description = data
		? t("subtitle", {
				scope: scopeLabel,
				plan: tp(`plans.${data.planId}.name`),
			})
		: null;

	return (
		<div className="space-y-6">
			<PageHeader
				title={
					firstName ? t("greeting", { name: firstName }) : t("greetingNoName")
				}
				description={
					description ??
					(overview.isError ? null : (
						<span
							aria-hidden="true"
							className="inline-block h-4 w-40 animate-pulse rounded-md bg-muted align-middle"
						/>
					))
				}
				actions={
					orgSlug ? (
						canInvite ? (
							<Button asChild>
								<Link href={`/organizations/${orgSlug}/settings/members`}>
									{t("inviteMember")}
								</Link>
							</Button>
						) : null
					) : config.features.organizationsMode !== "off" ? (
						<Button asChild variant="outline">
							<Link href="/organizations">{t("viewOrganizations")}</Link>
						</Button>
					) : null
				}
			/>
			{overview.isError || (orgSlug && orgQuery.isSuccess && !org) ? (
				<DashboardLoadError
					retrying={overview.isFetching || orgQuery.isFetching}
					onRetry={() => {
						if (orgSlug && !org) void orgQuery.refetch();
						else void overview.refetch();
					}}
				/>
			) : data ? (
				<div className="grid gap-4 lg:grid-cols-12">
					<div className="lg:col-span-12">
						<AreaKpis data={data} orgSlug={orgSlug} />
					</div>
					<ActivityChart days={data.activity.days} />
					<HappeningNow feed={data.feed} />
					<PlanUsage data={data} />
					<MakeItYours />
				</div>
			) : (
				<DashboardSkeleton />
			)}
		</div>
	);
}

function DashboardLoadError({
	retrying,
	onRetry,
}: {
	retrying: boolean;
	onRetry: () => void;
}) {
	const t = useTranslations("dashboard");
	return (
		<Card
			role="alert"
			data-testid="dashboard-load-error"
			className="items-center gap-4 px-6 py-10 text-center"
		>
			<span
				aria-hidden="true"
				className="inline-flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
			>
				<CloudAlert className="size-6" />
			</span>
			<div className="max-w-md space-y-1.5">
				<h2 className="font-bold font-heading text-lg tracking-heading">
					{t("loadErrorTitle")}
				</h2>
				<p className="text-muted-foreground text-sm leading-6">
					{t("loadError")}
				</p>
			</div>
			<Button onClick={onRetry} disabled={retrying}>
				<RotateCw className={retrying ? "animate-spin" : undefined} />
				{t("loadErrorRetry")}
			</Button>
		</Card>
	);
}

function DashboardSkeleton() {
	return (
		<div aria-hidden="true" className="grid gap-4 lg:grid-cols-12">
			<div className="grid gap-4 md:grid-cols-2 lg:col-span-12 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-40 rounded-2xl" />
				))}
			</div>
			<Skeleton className="h-96 rounded-2xl lg:col-span-8" />
			<Skeleton className="h-96 rounded-2xl lg:col-span-4" />
			<Skeleton className="h-64 rounded-2xl lg:col-span-6" />
			<Skeleton className="h-64 rounded-2xl lg:col-span-6" />
		</div>
	);
}
