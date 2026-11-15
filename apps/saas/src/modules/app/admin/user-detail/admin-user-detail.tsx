"use client";

import { isBanActive } from "@fuutu/auth/types";
import {
	Alert,
	AlertDescription,
	Avatar,
	AvatarFallback,
	AvatarImage,
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
import { Ban } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import {
	BanBadge,
	RoleBadge,
	TwoFactorBadge,
	VerifiedBadge,
} from "../admin-badges";
import { initials, isAdminRole } from "../admin-user-utils";
import { UserActions, useRevokeSession } from "./user-actions";
import { UserActivity } from "./user-activity";
import {
	ApiKeysSection,
	BillingSection,
	OrganizationsSection,
	OverviewSection,
	SessionsSection,
} from "./user-sections";

export function AdminUserDetail({
	userId,
	currentUserId,
}: {
	userId: string;
	currentUserId: string;
}) {
	const t = useTranslations("admin.userDetail");
	const format = useFormatter();
	const [revokeAllOpen, setRevokeAllOpen] = useState(false);
	const query = useQuery(
		orpc.admin.users.get.queryOptions({ input: { userId } }),
	);
	const revokeSession = useRevokeSession(userId);

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
							<Link href="/admin/users">{t("back")}</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	const user = query.data;
	if (!user) {
		return (
			<div className="space-y-6" aria-busy="true">
				<Skeleton className="h-28 w-full" />
				<Skeleton className="h-72 w-full" />
			</div>
		);
	}

	const banned = isBanActive(user);
	const admin = isAdminRole(user.role);

	return (
		<div className="space-y-6">
			<Card>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex min-w-0 items-center gap-4">
							<Avatar className="size-14">
								{user.image ? <AvatarImage src={user.image} alt="" /> : null}
								<AvatarFallback>
									{initials(user.name, user.email)}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 space-y-1">
								<h2 className="truncate font-bold font-heading text-xl">
									{user.name || t("noName")}
								</h2>
								<p className="truncate text-muted-foreground text-sm">
									{user.email}
								</p>
							</div>
						</div>
						<UserActions
							user={user}
							currentUserId={currentUserId}
							isBanned={banned}
							isAdmin={admin}
							revokeAllOpen={revokeAllOpen}
							onRevokeAllClose={() => setRevokeAllOpen(false)}
						/>
					</div>
					<div className="flex flex-wrap gap-2">
						<RoleBadge isAdmin={admin} />
						<BanBadge banned={banned} />
						<VerifiedBadge verified={user.emailVerified} />
						<TwoFactorBadge enabled={user.twoFactorEnabled} />
					</div>
					{banned ? (
						<Alert variant="destructive">
							<Ban aria-hidden="true" />
							<AlertDescription>
								<p>
									{user.banReason
										? t("banReason", { reason: user.banReason })
										: t("banNoReason")}
								</p>
								<p>
									{user.banExpires
										? t("banUntil", {
												date: format.dateTime(user.banExpires, {
													dateStyle: "medium",
													timeStyle: "short",
												}),
											})
										: t("banPermanent")}
								</p>
							</AlertDescription>
						</Alert>
					) : null}
				</CardContent>
			</Card>

			<Tabs defaultValue="overview" className="space-y-4">
				<TabsList className="h-auto max-w-full flex-wrap justify-start">
					<TabsTrigger value="overview">{t("tabs.overview")}</TabsTrigger>
					<TabsTrigger value="sessions">
						{t("tabs.sessions", { count: user.sessions.length })}
					</TabsTrigger>
					<TabsTrigger value="organizations">
						{t("tabs.organizations", { count: user.memberships.length })}
					</TabsTrigger>
					<TabsTrigger value="billing">{t("tabs.billing")}</TabsTrigger>
					<TabsTrigger value="apiKeys">
						{t("tabs.apiKeys", { count: user.apiKeys.length })}
					</TabsTrigger>
					<TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
				</TabsList>
				<TabsContent value="overview">
					<OverviewSection user={user} />
				</TabsContent>
				<TabsContent value="sessions">
					<SessionsSection
						user={user}
						busy={revokeSession.isPending}
						onRevoke={(sessionId) => revokeSession.mutate(sessionId)}
						onRevokeAll={() => setRevokeAllOpen(true)}
					/>
				</TabsContent>
				<TabsContent value="organizations">
					<OrganizationsSection user={user} />
				</TabsContent>
				<TabsContent value="billing">
					<BillingSection user={user} />
				</TabsContent>
				<TabsContent value="apiKeys">
					<ApiKeysSection user={user} />
				</TabsContent>
				<TabsContent value="activity">
					<UserActivity userId={user.id} />
				</TabsContent>
			</Tabs>
		</div>
	);
}
