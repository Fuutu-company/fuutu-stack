"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import {
	AccessControl,
	DEFAULT_ACCESS_POLICY,
	hasPermission,
	PERMISSIONS,
	toRbacRole,
} from "@fuutu/rbac";
import {
	Button,
	Card,
	CardContent,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { Mail, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

const log = createLogger({ scope: "org-members" });

const ac = new AccessControl(DEFAULT_ACCESS_POLICY);

const ORG_ROLE_OWNER = "owner";

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
	const [org, setOrg] = useState<FullOrg | null>(null);
	const [loading, setLoading] = useState(true);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
	const [inviting, setInviting] = useState(false);
	const [inviteError, setInviteError] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	const currentUserId = session?.user?.id;
	const currentUserRole = org?.members?.find(
		(m) => m.userId === currentUserId,
	)?.role;
	const canManageMembers = currentUserRole
		? hasPermission(
				ac,
				toRbacRole(currentUserRole),
				PERMISSIONS.INVITE_ORGANIZATION,
			)
		: false;

	const roleLabel: Record<string, string> = {
		owner: t("organizations.settings.roleOwner"),
		admin: t("organizations.settings.roleAdmin"),
		member: t("organizations.settings.roleMember"),
	};

	const load = useCallback(async () => {
		setLoading(true);
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
			const data = res.data as FullOrg | null;
			if (data) setOrg(data);
		} finally {
			setLoading(false);
		}
	}, [slug]);

	useEffect(() => {
		void load();
	}, [load]);

	async function invite(e: React.FormEvent) {
		e.preventDefault();
		if (!org) return;
		setInviting(true);
		setInviteError(null);
		try {
			const res = await authClient.organization.inviteMember({
				email: inviteEmail,
				role: inviteRole,
				organizationId: org.id,
			});
			if (res.error) {
				setInviteError(t("organizations.settings.failed"));
				return;
			}
			setInviteEmail("");
			await load();
		} finally {
			setInviting(false);
		}
	}

	async function removeMember(memberId: string) {
		if (!org) return;
		setBusy(memberId);
		setActionError(null);
		try {
			await authClient.organization.removeMember({
				memberIdOrEmail: memberId,
				organizationId: org.id,
			});
			await load();
		} catch (e) {
			log.error("removeMember failed", { err: e });
			setActionError(t("organizations.settings.failed"));
		} finally {
			setBusy(null);
		}
	}

	async function cancelInvite(id: string) {
		setBusy(id);
		setActionError(null);
		try {
			await authClient.organization.cancelInvitation({ invitationId: id });
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
			<div>
				<h1 className="font-bold text-3xl tracking-tight">
					{t("organizations.settings.members")}
				</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					{t("organizations.settings.membersDescription")}
				</p>
			</div>

			<Card>
				<CardContent className="space-y-6 p-6 md:p-8">
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
							<ul className="divide-y rounded-lg border">
								{org.members.map((m) => (
									<li
										key={m.id}
										className="flex items-center justify-between gap-4 p-3"
									>
										<div>
											<p className="font-medium text-sm">
												{m.user?.name ?? m.user?.email ?? m.userId}
											</p>
											<p className="text-muted-foreground text-xs">
												{m.user?.email} · {roleLabel[m.role] ?? m.role}
											</p>
										</div>
										{canManageMembers && m.role !== ORG_ROLE_OWNER && (
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
									</li>
								))}
							</ul>
						</div>
					)}

					{org.invitations && org.invitations.length > 0 && (
						<div>
							<p className="mb-2 font-medium text-sm">
								{t("organizations.settings.pendingInvitations")}
							</p>
							<ul className="divide-y rounded-lg border">
								{org.invitations
									.filter((i) => i.status === "pending")
									.map((i) => (
										<li
											key={i.id}
											className="flex items-center justify-between gap-4 p-3"
										>
											<div>
												<p className="font-medium text-sm">{i.email}</p>
												<p className="text-muted-foreground text-xs">
													{roleLabel[i.role] ?? i.role}
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
