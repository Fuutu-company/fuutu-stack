"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";

type ContactDeleteDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
};

export function ContactDeleteDialog({
	open,
	onOpenChange,
	onConfirm,
}: ContactDeleteDialogProps) {
	const t = useTranslations("crm");

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{t("deleteContact")}</AlertDialogTitle>
					<AlertDialogDescription>
						{t("deleteConfirmation")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
					<AlertDialogAction onClick={onConfirm}>
						{t("confirmDelete")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
