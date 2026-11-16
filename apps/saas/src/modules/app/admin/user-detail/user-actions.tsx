"use client";

import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@fuutu/ui";
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
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { client } from "@/utils/orpc";
import { useAdminAction } from "../admin-action";
import type { AdminUserDetailData } from "./types";
import {
	type ActionContext,
	BanDialog,
	DeleteDialog,
	EditDialog,
	ImpersonateDialog,
	ResetTwoFactorDialog,
	RoleDialog,
	UnbanDialog,
} from "./user-dialogs";
import { RevokeAllDialog } from "./user-session-actions";

type DialogKind =
	| "edit"
	| "ban"
	| "unban"
	| "role"
	| "resetTwoFactor"
	| "impersonate"
	| "delete"
	| "revokeAll";

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

	const verificationEmail = useAdminAction({
		mutationFn: () =>
			client.admin.users.sendVerificationEmail({ userId: user.id }),
		successKey: "userDetail.toast.verificationEmailSent",
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
			key: "sendVerificationEmail",
			icon: <MailCheck />,
			label: t("sendVerificationEmail"),
			disabledReason: user.emailVerified ? t("reason.alreadyVerified") : null,
			onSelect: () => verificationEmail.mutate(undefined),
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
