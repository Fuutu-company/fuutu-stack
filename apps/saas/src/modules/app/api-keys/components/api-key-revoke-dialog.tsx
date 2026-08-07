"use client";

import { createLogger } from "@fuutu/logs";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
	Button,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";

const log = createLogger({ scope: "api-key-revoke" });

export function ApiKeyRevokeDialog({
	apiKeyId,
	onRevoked,
}: {
	apiKeyId: string;
	onRevoked: () => void;
}) {
	const t = useTranslations("apiKeys");
	const tCommon = useTranslations("common");
	const [open, setOpen] = useState(false);
	const [revoking, setRevoking] = useState(false);

	async function revoke() {
		setRevoking(true);
		try {
			await orpc.apiKeys.revoke.call({ id: apiKeyId });
			setOpen(false);
			onRevoked();
		} catch (e) {
			log.error("api key revoke failed", { err: e });
			toast.error(t("revokeError"));
		} finally {
			setRevoking(false);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button variant="ghost" size="sm">
					{t("revoke")}
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("revokeDialog.title")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("revokeDialog.description")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
					<AlertDialogAction
						onClick={revoke}
						disabled={revoking}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{revoking ? t("revokeDialog.revoking") : t("revokeDialog.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
