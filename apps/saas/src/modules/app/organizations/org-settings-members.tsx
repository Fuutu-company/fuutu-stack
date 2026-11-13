"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import {
	assignableOrgRoles,
	canChangeMemberRole,
	hasOrgPermission,
	ORG_POLICY,
	OrgAccessControl,
	type OrgRole,
	PERMISSIONS,
	toOrgRole,
} from "@fuutu/rbac";
import {
	Button,
	Card,
	CardContent,
	Input,
	PageHeader,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { Mail, Sparkles, UserMinus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import {
	planGateMessage,
	type SeatLimit,
	seatLimitFromError,
} from "@/lib/api-error";
import { orpc } from "@/utils/orpc";
import {
	useFullOrganization,
	useInvalidateOrganization,
} from "./use-full-organization";

const log = createLogger({ scope: "org-members" });

const ac = new OrgAccessControl(ORG_POLICY);

type Member = {
	id: string;
	userId: string;
	role: string;
	user?: { name?: string | null; email?: string };
};

type Invitation = {
	id: string;
	email: string;
	role: string;
	status: string;
};

type FullOrg = {
	id: string;
	name: string;
	slug: string;
	members?: Member[];
	invitations?: Invitation[];
};

export function OrgSettingsMembers({ slug }: { slug: string }) {
	const t = useTranslations();
	const { data: session } = authClient.useSession();
	const orgQuery = useFullOrganization(slug);
	// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
	const org = (orgQuery.data ?? null) as FullOrg | null;
	const loading = orgQuery.isPending;
	const invalidateOrganization = useInvalidateOrganization();
	const load = () => invalidateOrganization(slug);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
	const [inviting, setInviting] = useState(false);
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	// Set from the server's PAYMENT_REQUIRED answer — seats are never
	// pre-counted here; the auth seat hook is the single source of truth.
	const [seatLimit, setSeatLimit] = useState<SeatLimit | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	const currentUserId = session?.user?.id;
	const currentUserRole = org?.members?.find(
		(m) => m.userId === currentUserId,
	)?.role;
	const canManageMembers = currentUserRole
		? hasOrgPermission(
				ac,
				toOrgRole(currentUserRole),
				PERMISSIONS.INVITE_MEMBER,
			)
		: false;
	const actorRole = toOrgRole(currentUserRole);
	// Same permission the updateRole procedure checks server-side.
	const canChangeRoles = currentUserRole
		? hasOrgPermission(ac, actorRole, PERMISSIONS.ORGANIZATION.UPDATE)
		: false;
	const ownerCount =
		org?.members?.filter((m) => toOrgRole(m.role) === "owner").length ?? 0;

	function roleOptionsFor(m: Member): OrgRole[] {
		const current = toOrgRole(m.role);
		if (!canChangeRoles || m.userId === currentUserId) return [];
		// The last owner keeps the role — an org always needs one.
		if (current === "owner" && ownerCount <= 1) return [];
		const options = assignableOrgRoles(actorRole).filter((role) =>
			canChangeMemberRole(actorRole, current, role),
		);
		return options.some((role) => role !== current) ? options : [];
	}

	const roleLabel: Record<string, string> = {
		owner: t("organizations.settings.roleOwner"),
		admin: t("organizations.settings.roleAdmin"),
		member: t("organizations.settings.roleMember"),
	};

	async function invite(e: React.FormEvent) {
		e.preventDefault();
		if (!org) return;
		setInviting(true);
		setInviteError(null);
		setSeatLimit(null);
		try {
			await orpc.organizations.members.invite.call({
				organizationId: org.id,
				email: inviteEmail,
				role: inviteRole,
			});
			setInviteEmail("");
			await load();
		} catch (e) {
			log.error("inviteMember failed", { err: e });
			const limit = seatLimitFromError(e);
			if (limit) {
				setSeatLimit(limit);
			} else {
				setInviteError(planGateMessage(e, t, "organizations.settings.failed"));
			}
		} finally {
			setInviting(false);
		}
	}

	async function removeMember(memberId: string) {
		if (!org) return;
		setBusy(memberId);
		setActionError(null);
		try {
			await orpc.organizations.members.remove.call({
				organizationId: org.id,
				memberIdOrEmail: memberId,
			});
			setSeatLimit(null);
			await load();
		} catch (e) {
			log.error("removeMember failed", { err: e });
			setActionError(t("organizations.settings.failed"));
		} finally {
			setBusy(null);
		}
	}

	async function changeRole(m: Member, role: OrgRole) {
		if (!org || toOrgRole(m.role) === role) return;
		setBusy(m.id);
		setActionError(null);
		try {
			await orpc.organizations.members.updateRole.call({
				organizationId: org.id,
				memberId: m.id,
				role,
			});
			toast.success(t("organizations.settings.roleUpdated"));
			await load();
		} catch (e) {
			log.error("updateMemberRole failed", { err: e });
			toast.error(t("organizations.settings.roleUpdateFailed"));
		} finally {
			setBusy(null);
		}
	}

	async function cancelInvite(id: string) {
		setBusy(id);
		setActionError(null);
		try {
			await orpc.organizations.invitations.revoke.call({
				invitationId: id,
			});
			setSeatLimit(null);
			await load();
		} catch (e) {
			log.error("cancelInvite failed", { err: e });
			setActionError(t("organizations.settings.failed"));
		} finally {
			setBusy(null);
		}
	}

	if (loading) {
		return (
			<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
		);
	}
	if (!org) {
		return <p className="text-muted-foreground text-sm">{t("common.error")}</p>;
	}

	return (
		<div className="space-y-6">
			<PageHeader
				variant="compact"
				title={t("organizations.settings.members")}
			/>

			<Card className="py-0">
				<CardContent className="space-y-6 p-6 md:p-8">
					{canManageMembers && seatLimit && (
						<div className="flex flex-col gap-3 rounded-xl bg-area-users p-4 text-area-users-foreground sm:flex-row sm:items-center sm:justify-between">
							<div className="min-w-0">
								<p className="font-bold text-sm">
									{t("organizations.settings.seatLimitReached", {
										seats: seatLimit.seatsTotal,
									})}
								</p>
								<p className="font-medium text-xs">
									{t("organizations.settings.seatLimitHint")}
								</p>
							</div>
							<Button asChild size="sm">
								<Link href={seatLimit.upgradeUrl}>
									<Sparkles className="size-4" />
									{t("organizations.settings.seatLimitCta")}
								</Link>
							</Button>
						</div>
					)}
					{canManageMembers && (
						<form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row">
							<Input
								type="email"
								placeholder={t("organizations.settings.invitePlaceholder")}
								value={inviteEmail}
								onChange={(e) => setInviteEmail(e.target.value)}
								required
								className="flex-1"
							/>
							<Select
								value={inviteRole}
								onValueChange={(v) => setInviteRole(v as "member" | "admin")}
							>
								<SelectTrigger
									aria-label={t("organizations.settings.roleSelectLabel")}
									className="sm:w-32"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="member">
										{t("organizations.settings.roleMember")}
									</SelectItem>
									<SelectItem value="admin">
										{t("organizations.settings.roleAdmin")}
									</SelectItem>
								</SelectContent>
							</Select>
							<Button type="submit" disabled={inviting || !inviteEmail}>
								<Mail className="mr-2 size-4" />
								{inviting
									? t("organizations.settings.sending")
									: t("organizations.settings.sendInvite")}
							</Button>
						</form>
					)}
					{inviteError && (
						<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
							{inviteError}
						</div>
					)}
					{actionError && (
						<div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
							{actionError}
						</div>
					)}

					{org.members && org.members.length > 0 && (
						<div>
							<p className="mb-2 font-medium text-sm">
								{t("organizations.settings.activeMembers")}
							</p>
							<ul className="divide-y overflow-hidden rounded-xl border">
								{org.members.map((m) => {
									const roleOptions = roleOptionsFor(m);
									const memberName = m.user?.name ?? m.user?.email ?? m.userId;
									return (
										<li
											key={m.id}
											className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3"
										>
											<div className="min-w-0 flex-1 basis-48">
												<p className="truncate font-medium text-sm">
													{memberName}
												</p>
												<p className="break-all text-muted-foreground text-xs">
													{m.user?.email} ·{" "}
													{roleLabel[toOrgRole(m.role)] ?? m.role}
												</p>
											</div>
											<div className="flex shrink-0 items-center gap-2">
												{roleOptions.length > 0 && (
													<Select
														value={toOrgRole(m.role)}
														onValueChange={(v) => changeRole(m, toOrgRole(v))}
														disabled={busy === m.id}
													>
														<SelectTrigger
															aria-label={t(
																"organizations.settings.changeRoleLabel",
																{ name: memberName },
															)}
															className="w-auto min-w-28"
														>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															{roleOptions.map((role) => (
																<SelectItem key={role} value={role}>
																	{roleLabel[role]}
																</SelectItem>
															))}
														</SelectContent>
													</Select>
												)}
												{canManageMembers && toOrgRole(m.role) !== "owner" && (
													<Button
														variant="ghost"
														size="sm"
														onClick={() => removeMember(m.id)}
														disabled={busy === m.id}
													>
														<UserMinus className="size-4" />
														<span className="sr-only">
															{t("organizations.settings.removeMember")}
														</span>
													</Button>
												)}
											</div>
										</li>
									);
								})}
							</ul>
						</div>
					)}

					{org.invitations?.some((i) => i.status === "pending") && (
						<div>
							<p className="mb-2 font-medium text-sm">
								{t("organizations.settings.pendingInvitations")}
							</p>
							<ul className="divide-y overflow-hidden rounded-xl border">
								{org.invitations
									.filter((i) => i.status === "pending")
									.map((i) => (
										<li
											key={i.id}
											className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 p-3"
										>
											<div className="min-w-0 flex-1 basis-48">
												<p className="break-all font-medium text-sm">
													{i.email}
												</p>
												<p className="text-muted-foreground text-xs">
													{roleLabel[toOrgRole(i.role)] ?? i.role}
												</p>
											</div>
											{canManageMembers && (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => cancelInvite(i.id)}
													disabled={busy === i.id}
												>
													{t("organizations.settings.cancelInvite")}
												</Button>
											)}
										</li>
									))}
							</ul>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
