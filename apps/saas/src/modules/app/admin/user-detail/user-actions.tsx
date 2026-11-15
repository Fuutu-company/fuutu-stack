"use client";

import { createLogger } from "@fuutu/logs";
import {
	Alert,
	AlertDescription,
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	Input,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Ban,
	ChevronDown,
	KeyRound,
	LogIn,
	MailCheck,
	Pencil,
	ShieldOff,
	Trash2,
	UserCog,
	UserRoundCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";
import { adminErrorKey } from "../admin-error";
import { ActionDialog, isReasonValid, ReasonField } from "./action-dialog";
import type { AdminUserDetailData } from "./types";

const log = createLogger({ scope: "admin-user-actions" });

type DialogKind =
	| "edit"
	| "ban"
	| "unban"
	| "role"
	| "resetTwoFactor"
	| "impersonate"
	| "delete"
	| "revokeAll";

type ActionContext = {
	user: AdminUserDetailData;
	isSelf: boolean;
	isAdmin: boolean;
	isBanned: boolean;
};

/** Runs an admin call, toasts the outcome and refreshes admin queries. */
function useAdminAction<TVars>(options: {
	mutationFn: (vars: TVars) => Promise<unknown>;
	successKey: string;
	onSuccess?: () => void;
}) {
	const t = useTranslations("admin");
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: options.mutationFn,
		onSuccess: async () => {
			toast.success(t(options.successKey));
			await queryClient.invalidateQueries({ queryKey: orpc.admin.key() });
			options.onSuccess?.();
		},
		onError: (error) => {
			log.error("admin user action failed", { err: error });
			toast.error(t(`errors.${adminErrorKey(error)}`));
		},
	});
}

export function UserActions({
	user,
	currentUserId,
	isBanned,
	isAdmin,
	sessionsBusy,
	revokeAllOpen,
	onRevokeAllClose,
}: {
	user: AdminUserDetailData;
	currentUserId: string;
	isBanned: boolean;
	isAdmin: boolean;
	sessionsBusy?: boolean;
	revokeAllOpen: boolean;
	onRevokeAllClose: () => void;
}) {
	const t = useTranslations("admin.userDetail.actions");
	const [dialog, setDialog] = useState<DialogKind | null>(null);
	const isSelf = currentUserId === user.id;
	const ctx: ActionContext = { user, isSelf, isAdmin, isBanned };

	const verifyEmail = useAdminAction({
		mutationFn: () =>
			client.admin.users.update({ userId: user.id, emailVerified: true }),
		successKey: "userDetail.toast.verified",
	});
	const passwordReset = useAdminAction({
		mutationFn: () => client.admin.users.sendPasswordReset({ userId: user.id }),
		successKey: "userDetail.toast.passwordReset",
	});

	const peerReason = isSelf
		? t("reason.self")
		: isAdmin
			? t("reason.peerAdmin")
			: null;

	const items: {
		key: string;
		icon: ReactNode;
		label: string;
		disabledReason: string | null;
		destructive?: boolean;
		onSelect: () => void;
	}[] = [
		{
			key: "edit",
			icon: <Pencil />,
			label: t("edit"),
			disabledReason: null,
			onSelect: () => setDialog("edit"),
		},
		{
			key: "verifyEmail",
			icon: <MailCheck />,
			label: t("verifyEmail"),
			disabledReason: user.emailVerified ? t("reason.alreadyVerified") : null,
			onSelect: () => verifyEmail.mutate(undefined),
		},
		{
			key: "passwordReset",
			icon: <KeyRound />,
			label: t("passwordReset"),
			disabledReason: null,
			onSelect: () => passwordReset.mutate(undefined),
		},
		{
			key: "role",
			icon: <UserCog />,
			label: t("role"),
			disabledReason: isSelf ? t("reason.self") : null,
			onSelect: () => setDialog("role"),
		},
		{
			key: "resetTwoFactor",
			icon: <ShieldOff />,
			label: t("resetTwoFactor"),
			disabledReason:
				peerReason ?? (user.twoFactorEnabled ? null : t("reason.noTwoFactor")),
			onSelect: () => setDialog("resetTwoFactor"),
		},
		isBanned
			? {
					key: "unban",
					icon: <UserRoundCheck />,
					label: t("unban"),
					disabledReason: null,
					onSelect: () => setDialog("unban"),
				}
			: {
					key: "ban",
					icon: <Ban />,
					label: t("ban"),
					disabledReason: peerReason,
					onSelect: () => setDialog("ban"),
				},
		{
			key: "impersonate",
			icon: <LogIn />,
			label: t("impersonate"),
			disabledReason: peerReason ?? (isBanned ? t("reason.banned") : null),
			onSelect: () => setDialog("impersonate"),
		},
		{
			key: "delete",
			icon: <Trash2 />,
			label: t("delete"),
			disabledReason: peerReason,
			destructive: true,
			onSelect: () => setDialog("delete"),
		},
	];

	const close = () => setDialog(null);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="outline" disabled={sessionsBusy}>
						{t("menu")}
						<ChevronDown aria-hidden="true" className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-72">
					<DropdownMenuLabel>{t("menu")}</DropdownMenuLabel>
					{items.map((item) => (
						<div key={item.key}>
							{item.key === "delete" ? <DropdownMenuSeparator /> : null}
							<DropdownMenuItem
								disabled={item.disabledReason !== null}
								onSelect={item.onSelect}
								className={
									item.destructive
										? "text-destructive focus:text-destructive"
										: undefined
								}
							>
								{item.icon}
								<span className="grid">
									<span>{item.label}</span>
									{item.disabledReason ? (
										<span className="text-muted-foreground text-xs">
											{item.disabledReason}
										</span>
									) : null}
								</span>
							</DropdownMenuItem>
						</div>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{dialog === "edit" ? <EditDialog ctx={ctx} onClose={close} /> : null}
			{dialog === "ban" ? <BanDialog ctx={ctx} onClose={close} /> : null}
			{dialog === "unban" ? <UnbanDialog ctx={ctx} onClose={close} /> : null}
			{dialog === "role" ? <RoleDialog ctx={ctx} onClose={close} /> : null}
			{dialog === "resetTwoFactor" ? (
				<ResetTwoFactorDialog ctx={ctx} onClose={close} />
			) : null}
			{dialog === "impersonate" ? (
				<ImpersonateDialog ctx={ctx} onClose={close} />
			) : null}
			{dialog === "delete" ? <DeleteDialog ctx={ctx} onClose={close} /> : null}
			{revokeAllOpen ? (
				<RevokeAllDialog ctx={ctx} onClose={onRevokeAllClose} />
			) : null}
		</>
	);
}

type DialogProps = { ctx: ActionContext; onClose: () => void };

function EditDialog({ ctx, onClose }: DialogProps) {
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

function BanDialog({ ctx, onClose }: DialogProps) {
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

function UnbanDialog({ ctx, onClose }: DialogProps) {
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

function RoleDialog({ ctx, onClose }: DialogProps) {
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

function ResetTwoFactorDialog({ ctx, onClose }: DialogProps) {
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

function ImpersonateDialog({ ctx, onClose }: DialogProps) {
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

function DeleteDialog({ ctx, onClose }: DialogProps) {
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

function RevokeAllDialog({ ctx, onClose }: DialogProps) {
	const t = useTranslations("admin.userDetail.dialog.revokeAll");
	const mutation = useAdminAction({
		mutationFn: () =>
			client.admin.users.revokeAllSessions({ userId: ctx.user.id }),
		successKey: "userDetail.toast.sessionsRevoked",
		onSuccess: onClose,
	});
	return (
		<ActionDialog
			destructive
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

/** Revokes one session; used by the sessions table. */
export function useRevokeSession(userId: string) {
	return useAdminAction({
		mutationFn: (sessionId: string) =>
			client.admin.users.revokeSession({ userId, sessionId }),
		successKey: "userDetail.toast.sessionRevoked",
	});
}
