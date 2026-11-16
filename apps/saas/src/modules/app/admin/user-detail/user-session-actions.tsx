"use client";

import { useTranslations } from "next-intl";
import { client } from "@/utils/orpc";
import { useAdminAction } from "../admin-action";
import { ActionDialog } from "./action-dialog";
import type { DialogProps } from "./user-dialogs";

export function RevokeAllDialog({ ctx, onClose }: DialogProps) {
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
