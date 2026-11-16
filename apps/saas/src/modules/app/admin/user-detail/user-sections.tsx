"use client";

import { Badge, Button, Card, CardContent } from "@fuutu/ui";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { RoleBadge, TwoFactorBadge, VerifiedBadge } from "../admin-badges";
import { OrgPlan } from "../org-plan";
import type { AdminUserDetailData } from "./types";

const KEY_MASK = "••••";
const WARNING = "border-transparent bg-warning text-warning-foreground";
const SUCCESS = "border-transparent bg-success text-success-foreground";

const th =
	"whitespace-nowrap px-4 py-3 text-left font-semibold text-muted-foreground text-xs";

function Empty({ children }: { children: string }) {
	return <p className="text-muted-foreground text-sm">{children}</p>;
}

function Fact({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1">
			<dt className="font-semibold text-muted-foreground text-xs">{label}</dt>
			<dd className="text-sm">{children}</dd>
		</div>
	);
}

export function OverviewSection({ user }: { user: AdminUserDetailData }) {
	const t = useTranslations("admin.userDetail.overview");
	const format = useFormatter();
	const lastActive = user.sessions.reduce<Date | null>(
		(latest, s) => (!latest || s.updatedAt > latest ? s.updatedAt : latest),
		null,
	);
	const hasPassword = user.accounts.some((a) => a.hasPassword);
	const providers = user.accounts.map((a) =>
		a.providerId === "credential" ? t("providerCredential") : a.providerId,
	);
	const date = (value: Date) =>
		format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });

	return (
		<Card>
			<CardContent className="space-y-6">
				<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Fact label={t("created")}>
						<span data-volatile>{date(user.createdAt)}</span>
					</Fact>
					<Fact label={t("lastActive")}>
						<span data-volatile>
							{lastActive ? date(lastActive) : t("never")}
						</span>
					</Fact>
					<Fact label={t("userId")}>
						<span className="break-all font-mono text-xs">{user.id}</span>
					</Fact>
					<Fact label={t("username")}>{user.username ?? t("none")}</Fact>
					<Fact label={t("locale")}>{user.locale ?? t("none")}</Fact>
					<Fact label={t("onboarding")}>
						{user.onboardingComplete
							? t("onboardingDone")
							: t("onboardingPending")}
					</Fact>
				</dl>
				<div className="space-y-3 border-t pt-4">
					<h3 className="font-semibold text-sm">{t("authMethods")}</h3>
					<dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<Fact label={t("providers")}>
							{providers.length > 0 ? (
								<span className="flex flex-wrap gap-1">
									{providers.map((name, index) => (
										<Badge key={`${name}-${index}`} variant="outline">
											{name}
										</Badge>
									))}
								</span>
							) : (
								t("none")
							)}
						</Fact>
						<Fact label={t("password")}>
							{hasPassword ? t("passwordSet") : t("passwordNone")}
						</Fact>
						<Fact label={t("passkeys")}>{user.passkeyCount}</Fact>
						<Fact label={t("twoFactor")}>
							<TwoFactorBadge enabled={user.twoFactorEnabled} />
						</Fact>
						<Fact label={t("emailVerified")}>
							<VerifiedBadge verified={user.emailVerified} />
						</Fact>
						<Fact label={t("role")}>
							<RoleBadge
								isAdmin={user.role?.split(",").includes("admin") ?? false}
							/>
						</Fact>
					</dl>
				</div>
			</CardContent>
		</Card>
	);
}

export function SessionsSection({
	user,
	busy,
	onRevoke,
	onRevokeAll,
}: {
	user: AdminUserDetailData;
	busy: boolean;
	onRevoke: (sessionId: string) => void;
	onRevokeAll: () => void;
}) {
	const t = useTranslations("admin.userDetail.sessions");
	const format = useFormatter();
	const date = (value: Date) =>
		format.dateTime(value, { dateStyle: "medium", timeStyle: "short" });

	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="space-y-4 p-6">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<p className="text-muted-foreground text-sm">{t("description")}</p>
					<Button
						variant="outline"
						size="sm"
						disabled={user.sessions.length === 0 || busy}
						onClick={onRevokeAll}
					>
						{t("revokeAll")}
					</Button>
				</div>
				{user.sessions.length === 0 ? (
					<Empty>{t("empty")}</Empty>
				) : (
					<div className="-mx-6 -mb-6 overflow-x-auto border-t">
						<table className="w-full text-sm">
							<thead className="bg-muted/50">
								<tr>
									<th scope="col" className={th}>
										{t("ip")}
									</th>
									<th scope="col" className={th}>
										{t("userAgent")}
									</th>
									<th scope="col" className={th}>
										{t("created")}
									</th>
									<th scope="col" className={th}>
										{t("expires")}
									</th>
									<th scope="col" className={th}>
										<span className="sr-only">{t("actions")}</span>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{user.sessions.map((s) => (
									<tr key={s.id}>
										<td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
											{s.ipAddress ?? t("unknown")}
										</td>
										<td className="max-w-64 px-4 py-3 text-xs">
											<span
												className="block truncate"
												title={s.userAgent ?? undefined}
											>
												{s.userAgent ?? t("unknown")}
											</span>
											{s.impersonatedBy ? (
												<Badge className={`${WARNING} mt-1`}>
													{t("impersonated")}
												</Badge>
											) : null}
										</td>
										<td
											className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
											data-volatile
										>
											{date(s.createdAt)}
										</td>
										<td
											className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
											data-volatile
										>
											{date(s.expiresAt)}
										</td>
										<td className="px-4 py-3 text-right">
											<Button
												variant="ghost"
												size="sm"
												disabled={busy}
												onClick={() => onRevoke(s.id)}
											>
												{t("revoke")}
											</Button>
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

export function OrganizationsSection({ user }: { user: AdminUserDetailData }) {
	const t = useTranslations("admin.userDetail.organizations");
	const tRole = useTranslations("admin.users.roleValue");
	const format = useFormatter();
	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="p-6">
				{user.memberships.length === 0 ? (
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
										{t("role")}
									</th>
									<th scope="col" className={th}>
										{t("joined")}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{user.memberships.map((m) => (
									<tr key={m.id}>
										<td className="px-4 py-3">
											<Link
												href={`/admin/organizations/${m.organization.id}`}
												className="font-medium underline-offset-4 hover:underline"
											>
												{m.organization.name}
											</Link>
											<span className="block text-muted-foreground text-xs">
												{m.organization.slug}
											</span>
										</td>
										<td className="px-4 py-3">
											<Badge variant="outline">
												{tRole.has(m.role) ? tRole(m.role) : m.role}
											</Badge>
										</td>
										<td
											className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
											data-volatile
										>
											{format.dateTime(m.createdAt, { dateStyle: "medium" })}
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

type Purchase = AdminUserDetailData["purchases"][number];

/** Purchases with their plan; `className` frames the scrolling table. */
function PurchaseTable({
	purchases,
	className,
}: {
	purchases: readonly Purchase[];
	className: string;
}) {
	const t = useTranslations("admin.userDetail.billing");
	const tPlans = useTranslations("payments.plans");
	const format = useFormatter();
	return (
		<div className={className}>
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
							{t("product")}
						</th>
						<th scope="col" className={th}>
							{t("quantity")}
						</th>
						<th scope="col" className={th}>
							{t("periodEnd")}
						</th>
					</tr>
				</thead>
				<tbody className="divide-y">
					{purchases.map((p) => (
						<tr key={p.id}>
							<td className="px-4 py-3 text-xs">{t(`typeValue.${p.type}`)}</td>
							<td className="px-4 py-3">
								<Badge variant="outline">{t(`statusValue.${p.status}`)}</Badge>
							</td>
							<td className="px-4 py-3 text-xs">{p.provider}</td>
							<td className="px-4 py-3 text-xs">
								{p.planId && tPlans.has(`${p.planId}.name`)
									? tPlans(`${p.planId}.name`)
									: t("none")}
							</td>
							<td className="px-4 py-3 font-mono text-xs">
								{p.productId ?? p.priceId}
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
	);
}

export function BillingSection({ user }: { user: AdminUserDetailData }) {
	const t = useTranslations("admin.userDetail.billing");
	const tRole = useTranslations("admin.users.roleValue");
	const format = useFormatter();
	return (
		<div className="space-y-6">
			<Card className="overflow-hidden py-0">
				<CardContent className="space-y-4 p-6">
					<div className="space-y-1">
						<h3 className="font-semibold text-sm">{t("organizations")}</h3>
						<p className="text-muted-foreground text-xs">
							{t("organizationsHint")}
						</p>
					</div>
					{user.memberships.length === 0 ? (
						<Empty>{t("noOrganizations")}</Empty>
					) : (
						<ul className="divide-y">
							{user.memberships.map((m) => (
								<li
									key={m.id}
									aria-label={m.organization.name}
									className="space-y-3 py-4 first:pt-0 last:pb-0"
								>
									<div className="flex flex-wrap items-center justify-between gap-2">
										<span className="flex flex-wrap items-center gap-2">
											<Link
												href={`/admin/organizations/${m.organization.id}`}
												className="font-medium text-sm underline-offset-4 hover:underline"
											>
												{m.organization.name}
											</Link>
											<Badge variant="outline">
												{tRole.has(m.role) ? tRole(m.role) : m.role}
											</Badge>
										</span>
										<OrgPlan
											subscription={m.organization.activeSubscription}
											statusLabel={(status) => t(`statusValue.${status}`)}
										/>
									</div>
									{m.organization.purchases.length === 0 ? (
										<Empty>{t("noPurchases")}</Empty>
									) : (
										<PurchaseTable
											purchases={m.organization.purchases}
											className="overflow-x-auto rounded-xl border"
										/>
									)}
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
			<Card className="overflow-hidden py-0">
				<CardContent className="space-y-4 p-6">
					<h3 className="font-semibold text-sm">{t("purchases")}</h3>
					{user.purchases.length === 0 ? (
						<Empty>{t("noPurchases")}</Empty>
					) : (
						<PurchaseTable
							purchases={user.purchases}
							className="-mx-6 -mb-6 overflow-x-auto border-t"
						/>
					)}
				</CardContent>
			</Card>
			<Card className="overflow-hidden py-0">
				<CardContent className="space-y-4 p-6">
					<h3 className="font-semibold text-sm">{t("credits")}</h3>
					{user.creditBalances.length === 0 ? (
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
									{user.creditBalances.map((c) => (
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

export function ApiKeysSection({ user }: { user: AdminUserDetailData }) {
	const t = useTranslations("admin.userDetail.apiKeys");
	const format = useFormatter();
	const now = Date.now();
	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="p-6">
				{user.apiKeys.length === 0 ? (
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
								{user.apiKeys.map((k) => {
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
