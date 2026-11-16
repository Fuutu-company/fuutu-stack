"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Badge,
	Button,
	Card,
	CardContent,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@fuutu/ui";
import { ORPCError } from "@orpc/client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { appAdminOrganizationSections } from "@/app-admin";
import { orpc } from "@/utils/orpc";
import {
	KIT_ORGANIZATION_TAB_KEYS,
	resolveAdminSections,
} from "../admin-sections";
import { initials } from "../admin-user-utils";
import { OrgPlan } from "../org-plan";
import { OrgActions } from "./org-actions";
import { OrgActivity } from "./org-activity";
import {
	ApiKeysSection,
	BillingSection,
	InvitationsSection,
	MembersSection,
} from "./org-sections";

/** Statuses of a subscription that currently gates the organization's access. */
const GATING_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "SCHEDULED_CANCEL"];

export function AdminOrganizationDetail({
	organizationId,
}: {
	organizationId: string;
}) {
	const t = useTranslations("admin.organizationDetail");
	const tSections = useTranslations("admin.sections");
	const tStatus = useTranslations("admin.userDetail.billing.statusValue");
	const format = useFormatter();
	const query = useQuery(
		orpc.admin.organizations.get.queryOptions({ input: { organizationId } }),
	);

	if (query.isError) {
		const notFound =
			query.error instanceof ORPCError && query.error.code === "NOT_FOUND";
		return (
			<Card>
				<CardContent className="flex flex-col items-center gap-4 py-8 text-center">
					<p role="alert" className="text-muted-foreground">
						{notFound ? t("notFound") : t("loadError")}
					</p>
					<div className="flex gap-2">
						{notFound ? null : (
							<Button variant="outline" onClick={() => void query.refetch()}>
								{t("retry")}
							</Button>
						)}
						<Button asChild variant="outline">
							<Link href="/admin/organizations">{t("back")}</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	const org = query.data;
	if (!org) {
		return (
			<div className="space-y-6" aria-busy="true">
				<Skeleton className="h-28 w-full" />
				<Skeleton className="h-72 w-full" />
			</div>
		);
	}

	const subscription =
		org.purchases.find(
			(p) => p.type === "SUBSCRIPTION" && GATING_STATUSES.includes(p.status),
		) ?? null;
	const appSections = resolveAdminSections(
		KIT_ORGANIZATION_TAB_KEYS,
		appAdminOrganizationSections,
	);

	return (
		<div className="space-y-6">
			<Card>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex min-w-0 items-center gap-4">
							<Avatar className="size-14">
								{org.logo ? <AvatarImage src={org.logo} alt="" /> : null}
								<AvatarFallback>{initials(org.name, org.slug)}</AvatarFallback>
							</Avatar>
							<div className="min-w-0 space-y-1">
								<h2 className="truncate font-bold font-heading text-xl">
									{org.name}
								</h2>
								<p className="truncate text-muted-foreground text-sm">
									{t("slug", { slug: org.slug })}
								</p>
							</div>
						</div>
						<OrgActions org={org} />
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<Badge variant="outline">
							{t("memberCount", { count: org.memberCount })}
						</Badge>
						<OrgPlan
							subscription={subscription}
							statusLabel={(status) =>
								tStatus.has(status) ? tStatus(status) : status
							}
						/>
						<span className="text-muted-foreground text-xs" data-volatile>
							{t("created", {
								date: format.dateTime(org.createdAt, { dateStyle: "medium" }),
							})}
						</span>
					</div>
				</CardContent>
			</Card>

			<Tabs defaultValue="members" className="space-y-4">
				<TabsList className="h-auto max-w-full flex-wrap justify-start">
					<TabsTrigger value="members">
						{t("tabs.members", { count: org.memberCount })}
					</TabsTrigger>
					<TabsTrigger value="invitations">
						{t("tabs.invitations", { count: org.invitations.length })}
					</TabsTrigger>
					<TabsTrigger value="billing">{t("tabs.billing")}</TabsTrigger>
					<TabsTrigger value="apiKeys">
						{t("tabs.apiKeys", { count: org.apiKeys.length })}
					</TabsTrigger>
					<TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
					{appSections.map((section) => (
						<TabsTrigger key={section.key} value={section.key}>
							{tSections(section.titleKey)}
						</TabsTrigger>
					))}
				</TabsList>
				<TabsContent value="members">
					<MembersSection org={org} />
				</TabsContent>
				<TabsContent value="invitations">
					<InvitationsSection org={org} />
				</TabsContent>
				<TabsContent value="billing">
					<BillingSection org={org} />
				</TabsContent>
				<TabsContent value="apiKeys">
					<ApiKeysSection org={org} />
				</TabsContent>
				<TabsContent value="activity">
					<OrgActivity organizationId={org.id} />
				</TabsContent>
				{appSections.map((section) => (
					<TabsContent key={section.key} value={section.key}>
						<section.Component organizationId={org.id} />
					</TabsContent>
				))}
			</Tabs>
		</div>
	);
}
