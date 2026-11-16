"use client";

import { toOrgRole } from "@fuutu/rbac";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Badge,
	Button,
	Card,
	CardContent,
} from "@fuutu/ui";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { initials } from "../admin-user-utils";
import {
	CancelInvitationDialog,
	MemberActions,
	memberDisplayName,
	useResendInvitation,
} from "./org-member-actions";
import type {
	AdminOrganizationDetailData,
	AdminOrganizationInvitation,
} from "./types";

const KEY_MASK = "••••";
const WARNING = "border-transparent bg-warning text-warning-foreground";
const SUCCESS = "border-transparent bg-success text-success-foreground";
/** Statuses whose subscription quantity is the organization's seat count. */
const SEAT_STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "SCHEDULED_CANCEL"];

const th =
	"whitespace-nowrap px-4 py-3 text-left font-semibold text-muted-foreground text-xs";

function Empty({ children }: { children: string }) {
	return <p className="text-muted-foreground text-sm">{children}</p>;
}

type SectionProps = { org: AdminOrganizationDetailData };

export function MembersSection({ org }: SectionProps) {
	const t = useTranslations("admin.organizationDetail.members");
	const tRole = useTranslations("admin.users.roleValue");
	const format = useFormatter();
	const ownerCount = org.members.filter(
		(m) => toOrgRole(m.role) === "owner",
	).length;

	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="space-y-4 p-6">
				<p className="text-muted-foreground text-sm">{t("description")}</p>
				{org.members.length === 0 ? (
					<Empty>{t("empty")}</Empty>
				) : (
					<div className="-mx-6 -mb-6 overflow-x-auto border-t">
						<table className="w-full text-sm">
							<thead className="bg-muted/50">
								<tr>
									<th scope="col" className={th}>
										{t("user")}
									</th>
									<th scope="col" className={th}>
										{t("role")}
									</th>
									<th scope="col" className={th}>
										{t("joined")}
									</th>
									<th scope="col" className={th}>
										<span className="sr-only">{t("actions")}</span>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{org.members.map((m) => {
									const role = toOrgRole(m.role);
									return (
										<tr key={m.id}>
											<td className="px-4 py-3">
												<Link
													href={`/admin/users/${m.user.id}`}
													className="flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
												>
													<Avatar className="size-8">
														{m.user.image ? (
															<AvatarImage src={m.user.image} alt="" />
														) : null}
														<AvatarFallback className="text-xs">
															{initials(m.user.name, m.user.email)}
														</AvatarFallback>
													</Avatar>
													<span className="min-w-0">
														<span className="block truncate font-medium">
															{memberDisplayName(m)}
														</span>
														{m.user.name ? (
															<span className="block truncate text-muted-foreground text-xs">
																{m.user.email}
															</span>
														) : null}
													</span>
												</Link>
											</td>
											<td className="px-4 py-3">
												<Badge variant="outline">{tRole(role)}</Badge>
											</td>
											<td
												className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
												data-volatile
											>
												{format.dateTime(m.createdAt, { dateStyle: "medium" })}
											</td>
											<td className="px-4 py-3 text-right">
												<MemberActions
													organizationId={org.id}
													member={m}
													ownerCount={ownerCount}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
				{org.memberCount > org.members.length ? (
					<p className="text-muted-foreground text-xs">
						{t("truncated", {
							shown: org.members.length,
							total: org.memberCount,
						})}
					</p>
				) : null}
			</CardContent>
		</Card>
	);
}

export function InvitationsSection({ org }: SectionProps) {
	const t = useTranslations("admin.organizationDetail.invitations");
	const tRole = useTranslations("admin.users.roleValue");
	const format = useFormatter();
	const resend = useResendInvitation(org.id);
	const [canceling, setCanceling] =
		useState<AdminOrganizationInvitation | null>(null);

	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="space-y-4 p-6">
				<p className="text-muted-foreground text-sm">{t("description")}</p>
				{org.invitations.length === 0 ? (
					<Empty>{t("empty")}</Empty>
				) : (
					<div className="-mx-6 -mb-6 overflow-x-auto border-t">
						<table className="w-full text-sm">
							<thead className="bg-muted/50">
								<tr>
									<th scope="col" className={th}>
										{t("email")}
									</th>
									<th scope="col" className={th}>
										{t("role")}
									</th>
									<th scope="col" className={th}>
										{t("status")}
									</th>
									<th scope="col" className={th}>
										{t("expires")}
									</th>
									<th scope="col" className={th}>
										{t("inviter")}
									</th>
									<th scope="col" className={th}>
										<span className="sr-only">{t("actions")}</span>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{org.invitations.map((inv) => (
									<tr key={inv.id}>
										<td className="px-4 py-3 font-medium">{inv.email}</td>
										<td className="px-4 py-3">
											<Badge variant="outline">
												{tRole(toOrgRole(inv.role))}
											</Badge>
										</td>
										<td className="px-4 py-3">
											{inv.expired ? (
												<Badge className={WARNING}>{t("expired")}</Badge>
											) : (
												<Badge className={SUCCESS}>{t("pending")}</Badge>
											)}
										</td>
										<td
											className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
											data-volatile
										>
											{format.dateTime(inv.expiresAt, {
												dateStyle: "medium",
												timeStyle: "short",
											})}
										</td>
										<td className="px-4 py-3 text-xs">
											{inv.inviter?.name ?? t("unknownInviter")}
										</td>
										<td className="whitespace-nowrap px-4 py-3 text-right">
											<Button
												variant="ghost"
												size="sm"
												disabled={resend.isPending}
												onClick={() => resend.mutate(inv.id)}
											>
												{t("resend")}
											</Button>
											<Button
												variant="ghost"
												size="sm"
												onClick={() => setCanceling(inv)}
											>
												{t("cancel")}
											</Button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</CardContent>
			{canceling ? (
				<CancelInvitationDialog
					organizationId={org.id}
					invitation={canceling}
					onClose={() => setCanceling(null)}
				/>
			) : null}
		</Card>
	);
}

export function BillingSection({ org }: SectionProps) {
	const t = useTranslations("admin.organizationDetail.billing");
	const tUser = useTranslations("admin.userDetail.billing");
	const tPlans = useTranslations("payments.plans");
	const format = useFormatter();
	const seatSubscription = org.purchases.find(
		(p) => p.type === "SUBSCRIPTION" && SEAT_STATUSES.includes(p.status),
	);

	return (
		<div className="space-y-6">
			<Card className="overflow-hidden py-0">
				<CardContent className="space-y-4 p-6">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h3 className="font-semibold text-sm">{t("purchases")}</h3>
						<p className="text-muted-foreground text-xs">
							{seatSubscription
								? t("summary", {
										members: org.memberCount,
										seats: seatSubscription.quantity,
									})
								: t("summaryNoSeats", { members: org.memberCount })}
						</p>
					</div>
					{org.purchases.length === 0 ? (
						<Empty>{t("noPurchases")}</Empty>
					) : (
						<div className="-mx-6 -mb-6 overflow-x-auto border-t">
							<table className="w-full text-sm">
								<thead className="bg-muted/50">
									<tr>
										<th scope="col" className={th}>
											{t("type")}
										</th>
										<th scope="col" className={th}>
											{t("status")}
										</th>
										<th scope="col" className={th}>
											{t("provider")}
										</th>
										<th scope="col" className={th}>
											{t("plan")}
										</th>
										<th scope="col" className={th}>
											{t("seats")}
										</th>
										<th scope="col" className={th}>
											{t("periodEnd")}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{org.purchases.map((p) => (
										<tr key={p.id}>
											<td className="px-4 py-3 text-xs">
												{tUser(`typeValue.${p.type}`)}
											</td>
											<td className="px-4 py-3">
												<Badge variant="outline">
													{tUser(`statusValue.${p.status}`)}
												</Badge>
											</td>
											<td className="px-4 py-3 text-xs">{p.provider}</td>
											<td className="px-4 py-3 text-xs">
												{p.planId && tPlans.has(`${p.planId}.name`)
													? tPlans(`${p.planId}.name`)
													: t("otherPlan")}
											</td>
											<td className="px-4 py-3 text-xs">{p.quantity}</td>
											<td
												className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
												data-volatile
											>
												{p.currentPeriodEnd
													? format.dateTime(p.currentPeriodEnd, {
															dateStyle: "medium",
														})
													: t("none")}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>
			<Card className="overflow-hidden py-0">
				<CardContent className="space-y-4 p-6">
					<h3 className="font-semibold text-sm">{t("credits")}</h3>
					{org.creditBalances.length === 0 ? (
						<Empty>{t("noCredits")}</Empty>
					) : (
						<div className="-mx-6 -mb-6 overflow-x-auto border-t">
							<table className="w-full text-sm">
								<thead className="bg-muted/50">
									<tr>
										<th scope="col" className={th}>
											{t("meter")}
										</th>
										<th scope="col" className={th}>
											{t("remaining")}
										</th>
										<th scope="col" className={th}>
											{t("resets")}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{org.creditBalances.map((c) => (
										<tr key={c.meterKey}>
											<td className="px-4 py-3 font-mono text-xs">
												{c.meterKey}
											</td>
											<td className="px-4 py-3 text-xs">
												{t("remainingValue", {
													remaining: format.number(
														Math.max(
															0,
															c.recurringGranted - c.recurringConsumed,
														),
													),
													granted: format.number(c.recurringGranted),
												})}
											</td>
											<td
												className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
												data-volatile
											>
												{c.recurringPeriodEnd
													? format.dateTime(c.recurringPeriodEnd, {
															dateStyle: "medium",
														})
													: t("none")}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export function ApiKeysSection({ org }: SectionProps) {
	const t = useTranslations("admin.organizationDetail.apiKeys");
	const format = useFormatter();
	const now = Date.now();
	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="p-6">
				{org.apiKeys.length === 0 ? (
					<Empty>{t("empty")}</Empty>
				) : (
					<div className="-mx-6 -my-6 overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-muted/50">
								<tr>
									<th scope="col" className={th}>
										{t("name")}
									</th>
									<th scope="col" className={th}>
										{t("key")}
									</th>
									<th scope="col" className={th}>
										{t("scopes")}
									</th>
									<th scope="col" className={th}>
										{t("lastUsed")}
									</th>
									<th scope="col" className={th}>
										{t("status")}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{org.apiKeys.map((k) => {
									const revoked = k.revokedAt !== null;
									const expired =
										k.expiresAt !== null && k.expiresAt.getTime() <= now;
									return (
										<tr key={k.id}>
											<td className="px-4 py-3 font-medium">{k.name}</td>
											<td className="whitespace-nowrap px-4 py-3 font-mono text-muted-foreground text-xs">
												{`${k.prefix}${KEY_MASK}`}
											</td>
											<td className="px-4 py-3">
												{k.scopes.length === 0 ? (
													<span className="text-muted-foreground text-xs">
														{t("allScopes")}
													</span>
												) : (
													<span className="flex flex-wrap gap-1">
														{k.scopes.map((scope) => (
															<Badge key={scope} variant="outline">
																{scope}
															</Badge>
														))}
													</span>
												)}
											</td>
											<td
												className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
												data-volatile
											>
												{k.lastUsedAt
													? format.dateTime(k.lastUsedAt, {
															dateStyle: "medium",
														})
													: t("never")}
											</td>
											<td className="px-4 py-3">
												{revoked ? (
													<Badge variant="destructive">{t("revoked")}</Badge>
												) : expired ? (
													<Badge className={WARNING}>{t("expired")}</Badge>
												) : (
													<Badge className={SUCCESS}>{t("active")}</Badge>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
