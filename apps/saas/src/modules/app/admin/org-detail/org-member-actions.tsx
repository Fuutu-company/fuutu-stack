"use client";

import { type OrgRole, toOrgRole } from "@fuutu/rbac";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { Crown, MoreHorizontal, UserCog, UserMinus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { client } from "@/utils/orpc";
import { useAdminAction } from "../admin-action";
import {
	ActionDialog,
	isReasonValid,
	ReasonField,
} from "../user-detail/action-dialog";
import type {
	AdminOrganizationInvitation,
	AdminOrganizationMember,
} from "./types";

type MemberDialog = "role" | "remove" | "owner";

export function memberDisplayName(member: AdminOrganizationMember): string {
	return member.user.name || member.user.email;
}

export function MemberActions({
	organizationId,
	member,
	ownerCount,
}: {
	organizationId: string;
	member: AdminOrganizationMember;
	ownerCount: number;
}) {
	const t = useTranslations("admin.organizationDetail.members");
	const [dialog, setDialog] = useState<MemberDialog | null>(null);
	const close = () => setDialog(null);
	const isSoleOwner = toOrgRole(member.role) === "owner" && ownerCount <= 1;

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon"
						aria-label={t("menu", { name: memberDisplayName(member) })}
					>
						<MoreHorizontal aria-hidden="true" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuLabel>{memberDisplayName(member)}</DropdownMenuLabel>
					<DropdownMenuItem onSelect={() => setDialog("role")}>
						<UserCog />
						{t("changeRole")}
					</DropdownMenuItem>
					<DropdownMenuItem
						disabled={isSoleOwner}
						onSelect={() => setDialog("owner")}
					>
						<Crown />
						<span className="grid">
							<span>{t("makeOwner")}</span>
							{isSoleOwner ? (
								<span className="text-muted-foreground text-xs">
									{t("alreadyOwner")}
								</span>
							) : null}
						</span>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						className="text-destructive focus:text-destructive"
						onSelect={() => setDialog("remove")}
					>
						<UserMinus />
						{t("remove")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			{dialog === "role" ? (
				<RoleDialog
					organizationId={organizationId}
					member={member}
					onClose={close}
				/>
			) : null}
			{dialog === "owner" ? (
				<TransferDialog
					organizationId={organizationId}
					member={member}
					onClose={close}
				/>
			) : null}
			{dialog === "remove" ? (
				<RemoveDialog
					organizationId={organizationId}
					member={member}
					onClose={close}
				/>
			) : null}
		</>
	);
}

type MemberDialogProps = {
	organizationId: string;
	member: AdminOrganizationMember;
	onClose: () => void;
};

function RoleDialog({ organizationId, member, onClose }: MemberDialogProps) {
	const t = useTranslations("admin.organizationDetail.dialog.role");
	const tRole = useTranslations("admin.users.roleValue");
	const current = toOrgRole(member.role);
	const [role, setRole] = useState<OrgRole>(current);
	const [reason, setReason] = useState("");
	const roleId = useId();

	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.organizations.updateMemberRole({
				organizationId,
				memberId: member.id,
				role,
				reason: reason.trim(),
			}),
		successKey: "organizationDetail.toast.roleChanged",
		onSuccess: onClose,
	});

	return (
		<ActionDialog
			title={t("title")}
			description={t("description", { name: memberDisplayName(member) })}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={role !== current && isReasonValid(reason)}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<div className="space-y-2">
				<Label htmlFor={roleId}>{t("role")}</Label>
				<Select
					value={role}
					onValueChange={(value) => setRole(toOrgRole(value))}
				>
					<SelectTrigger id={roleId}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="owner">{tRole("owner")}</SelectItem>
						<SelectItem value="admin">{tRole("admin")}</SelectItem>
						<SelectItem value="member">{tRole("member")}</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<ReasonField value={reason} onChange={setReason} />
		</ActionDialog>
	);
}

function TransferDialog({
	organizationId,
	member,
	onClose,
}: MemberDialogProps) {
	const t = useTranslations(
		"admin.organizationDetail.dialog.transferOwnership",
	);
	const [reason, setReason] = useState("");
	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.organizations.transferOwnership({
				organizationId,
				memberId: member.id,
				reason: reason.trim(),
			}),
		successKey: "organizationDetail.toast.ownershipTransferred",
		onSuccess: onClose,
	});
	return (
		<ActionDialog
			title={t("title")}
			description={t("description", { name: memberDisplayName(member) })}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={isReasonValid(reason)}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<ReasonField value={reason} onChange={setReason} />
		</ActionDialog>
	);
}

function RemoveDialog({ organizationId, member, onClose }: MemberDialogProps) {
	const t = useTranslations("admin.organizationDetail.dialog.removeMember");
	const [reason, setReason] = useState("");
	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.organizations.removeMember({
				organizationId,
				memberId: member.id,
				reason: reason.trim(),
			}),
		successKey: "organizationDetail.toast.memberRemoved",
		onSuccess: onClose,
	});
	return (
		<ActionDialog
			destructive
			title={t("title")}
			description={t("description", { name: memberDisplayName(member) })}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={isReasonValid(reason)}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<ReasonField value={reason} onChange={setReason} />
		</ActionDialog>
	);
}

/** Sends a pending invitation again — no dialog, nothing destructive. */
export function useResendInvitation(organizationId: string) {
	return useAdminAction({
		mutationFn: (invitationId: string) =>
			client.admin.organizations.resendInvitation({
				organizationId,
				invitationId,
			}),
		successKey: (result) =>
			result.emailSent
				? { key: "organizationDetail.toast.invitationResent" }
				: {
						key: "organizationDetail.toast.invitationResentNoEmail",
						warn: true,
					},
	});
}

export function CancelInvitationDialog({
	organizationId,
	invitation,
	onClose,
}: {
	organizationId: string;
	invitation: AdminOrganizationInvitation;
	onClose: () => void;
}) {
	const t = useTranslations("admin.organizationDetail.dialog.cancelInvitation");
	const [reason, setReason] = useState("");
	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.organizations.cancelInvitation({
				organizationId,
				invitationId: invitation.id,
				...(reason.trim() ? { reason: reason.trim() } : {}),
			}),
		successKey: "organizationDetail.toast.invitationCanceled",
		onSuccess: onClose,
	});
	return (
		<ActionDialog
			destructive
			title={t("title")}
			description={t("description", { email: invitation.email })}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={reason.trim() === "" || isReasonValid(reason)}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<ReasonField value={reason} onChange={setReason} required={false} />
		</ActionDialog>
	);
}
