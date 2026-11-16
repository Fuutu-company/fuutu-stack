"use client";

import {
	Alert,
	AlertDescription,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { client } from "@/utils/orpc";
import { useAdminAction } from "../admin-action";
import { ActionDialog, isReasonValid, ReasonField } from "./action-dialog";
import type { AdminUserDetailData } from "./types";

export type ActionContext = {
	user: AdminUserDetailData;
	isSelf: boolean;
	isAdmin: boolean;
	isBanned: boolean;
};

export type DialogProps = { ctx: ActionContext; onClose: () => void };

export function EditDialog({ ctx, onClose }: DialogProps) {
	const t = useTranslations("admin.userDetail.dialog.edit");
	const { user, isSelf, isAdmin } = ctx;
	const [name, setName] = useState(user.name ?? "");
	const [email, setEmail] = useState(user.email);
	const [reason, setReason] = useState("");
	const nameId = useId();
	const emailId = useId();
	const emailLocked = isSelf || isAdmin;
	const nameChanged = name.trim() !== (user.name ?? "") && name.trim() !== "";
	const emailChanged =
		!emailLocked && email.trim().toLowerCase() !== user.email.toLowerCase();

	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.users.update({
				userId: user.id,
				...(nameChanged ? { name: name.trim() } : {}),
				...(emailChanged ? { email: email.trim(), reason: reason.trim() } : {}),
			}),
		successKey: "userDetail.toast.updated",
		onSuccess: onClose,
	});

	return (
		<ActionDialog
			title={t("title")}
			description={t("description")}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={
				(nameChanged || emailChanged) &&
				(!emailChanged || isReasonValid(reason))
			}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<div className="space-y-2">
				<Label htmlFor={nameId}>{t("name")}</Label>
				<Input
					id={nameId}
					value={name}
					maxLength={100}
					onChange={(e) => setName(e.target.value)}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor={emailId}>{t("email")}</Label>
				<Input
					id={emailId}
					type="email"
					value={email}
					disabled={emailLocked}
					onChange={(e) => setEmail(e.target.value)}
				/>
				{emailLocked ? (
					<p className="text-muted-foreground text-xs">
						{isSelf ? t("emailLockedSelf") : t("emailLockedAdmin")}
					</p>
				) : null}
			</div>
			{emailChanged ? (
				<>
					<Alert>
						<AlertDescription>{t("emailWarning")}</AlertDescription>
					</Alert>
					<ReasonField value={reason} onChange={setReason} />
				</>
			) : null}
		</ActionDialog>
	);
}

export function BanDialog({ ctx, onClose }: DialogProps) {
	const t = useTranslations("admin.userDetail.dialog.ban");
	const [reason, setReason] = useState("");
	const [until, setUntil] = useState("");
	const untilId = useId();
	const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
		.toISOString()
		.slice(0, 10);

	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.users.ban({
				userId: ctx.user.id,
				reason: reason.trim(),
				...(until ? { expiresAt: new Date(`${until}T23:59:59`) } : {}),
			}),
		successKey: "userDetail.toast.banned",
		onSuccess: onClose,
	});

	return (
		<ActionDialog
			destructive
			title={t("title")}
			description={t("description")}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={isReasonValid(reason)}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<ReasonField value={reason} onChange={setReason} />
			<div className="space-y-2">
				<Label htmlFor={untilId}>{t("until")}</Label>
				<Input
					id={untilId}
					type="date"
					min={tomorrow}
					value={until}
					onChange={(e) => setUntil(e.target.value)}
				/>
				<p className="text-muted-foreground text-xs">{t("untilHint")}</p>
			</div>
		</ActionDialog>
	);
}

export function UnbanDialog({ ctx, onClose }: DialogProps) {
	const t = useTranslations("admin.userDetail.dialog.unban");
	const mutation = useAdminAction({
		mutationFn: () => client.admin.users.unban({ userId: ctx.user.id }),
		successKey: "userDetail.toast.unbanned",
		onSuccess: onClose,
	});
	return (
		<ActionDialog
			title={t("title")}
			description={t("description")}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		/>
	);
}

export function RoleDialog({ ctx, onClose }: DialogProps) {
	const t = useTranslations("admin.userDetail.dialog.role");
	const tRole = useTranslations("admin.users.roleValue");
	const current = ctx.isAdmin ? "admin" : "user";
	const [role, setRole] = useState<"admin" | "user">(current);
	const [reason, setReason] = useState("");
	const roleId = useId();

	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.users.setRole({
				userId: ctx.user.id,
				role,
				reason: reason.trim(),
			}),
		successKey: "userDetail.toast.roleChanged",
		onSuccess: onClose,
	});

	return (
		<ActionDialog
			title={t("title")}
			description={t("description")}
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
					onValueChange={(value) =>
						setRole(value === "admin" ? "admin" : "user")
					}
				>
					<SelectTrigger id={roleId}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="user">{tRole("user")}</SelectItem>
						<SelectItem value="admin">{tRole("admin")}</SelectItem>
					</SelectContent>
				</Select>
				{role === "user" && current === "admin" ? (
					<p className="text-muted-foreground text-xs">{t("demoteHint")}</p>
				) : null}
			</div>
			<ReasonField value={reason} onChange={setReason} />
		</ActionDialog>
	);
}

export function ResetTwoFactorDialog({ ctx, onClose }: DialogProps) {
	const t = useTranslations("admin.userDetail.dialog.resetTwoFactor");
	const [reason, setReason] = useState("");
	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.users.resetTwoFactor({
				userId: ctx.user.id,
				reason: reason.trim(),
			}),
		successKey: "userDetail.toast.twoFactorReset",
		onSuccess: onClose,
	});
	return (
		<ActionDialog
			destructive
			title={t("title")}
			description={t("description")}
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

export function ImpersonateDialog({ ctx, onClose }: DialogProps) {
	const t = useTranslations("admin.userDetail.dialog.impersonate");
	const [reason, setReason] = useState("");
	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.users.impersonate({
				userId: ctx.user.id,
				reason: reason.trim(),
			}),
		successKey: "userDetail.toast.impersonating",
		// New session cookies: a full navigation, not a client transition.
		navigatesAway: true,
		onSuccess: () => window.location.assign("/dashboard"),
	});
	return (
		<ActionDialog
			title={t("title")}
			description={t("description", { email: ctx.user.email })}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={isReasonValid(reason)}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<Alert>
				<AlertDescription>{t("limits")}</AlertDescription>
			</Alert>
			<ReasonField value={reason} onChange={setReason} />
		</ActionDialog>
	);
}

export function DeleteDialog({ ctx, onClose }: DialogProps) {
	const t = useTranslations("admin.userDetail.dialog.delete");
	const router = useRouter();
	const [reason, setReason] = useState("");
	const [confirmEmail, setConfirmEmail] = useState("");
	const confirmId = useId();
	const matches =
		confirmEmail.trim().toLowerCase() === ctx.user.email.toLowerCase();

	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.users.delete({
				userId: ctx.user.id,
				reason: reason.trim(),
				confirmEmail: confirmEmail.trim(),
			}),
		successKey: "userDetail.toast.deleted",
		onSuccess: () => router.replace("/admin/users"),
	});

	return (
		<ActionDialog
			destructive
			title={t("title")}
			description={t("description", { email: ctx.user.email })}
			confirmLabel={t("confirm")}
			busy={mutation.isPending}
			canSubmit={matches && isReasonValid(reason)}
			onConfirm={() => mutation.mutate(undefined)}
			onClose={onClose}
		>
			<div className="space-y-2">
				<Label htmlFor={confirmId}>
					{t("confirmLabel", { email: ctx.user.email })}
				</Label>
				<Input
					id={confirmId}
					value={confirmEmail}
					autoComplete="off"
					onChange={(e) => setConfirmEmail(e.target.value)}
				/>
			</div>
			<ReasonField value={reason} onChange={setReason} />
		</ActionDialog>
	);
}
