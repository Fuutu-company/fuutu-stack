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
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Label,
	Textarea,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";

/** Shortest reason the API accepts. */
export const MIN_REASON_LENGTH = 3;
export const MAX_REASON_LENGTH = 500;

export function isReasonValid(reason: string): boolean {
	return reason.trim().length >= MIN_REASON_LENGTH;
}

export function ReasonField({
	value,
	onChange,
	required = true,
}: {
	value: string;
	onChange: (value: string) => void;
	required?: boolean;
}) {
	const t = useTranslations("admin.userDetail.dialog");
	const id = useId();
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{required ? t("reason") : t("reasonOptional")}</Label>
			<Textarea
				id={id}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				maxLength={MAX_REASON_LENGTH}
				required={required}
				placeholder={t("reasonPlaceholder")}
				rows={3}
			/>
			<p className="text-muted-foreground text-xs">{t("reasonHint")}</p>
		</div>
	);
}

type ActionDialogProps = {
	title: string;
	description: string;
	confirmLabel: string;
	busy: boolean;
	canSubmit: boolean;
	/** Irreversible or access-removing: renders as an alert dialog. */
	destructive?: boolean;
	onConfirm: () => void;
	onClose: () => void;
	children?: ReactNode;
};

/**
 * One confirm dialog for every admin action. Mount it only while open —
 * its fields then start empty each time. A destructive action uses the
 * alert dialog and stays open until the request settles.
 */
export function ActionDialog({
	title,
	description,
	confirmLabel,
	busy,
	canSubmit,
	destructive = false,
	onConfirm,
	onClose,
	children,
}: ActionDialogProps) {
	const tCommon = useTranslations("common");
	const disabled = busy || !canSubmit;

	if (destructive) {
		return (
			<AlertDialog open onOpenChange={(open) => !open && !busy && onClose()}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{title}</AlertDialogTitle>
						<AlertDialogDescription>{description}</AlertDialogDescription>
					</AlertDialogHeader>
					{children ? <div className="space-y-4">{children}</div> : null}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={busy}>
							{tCommon("cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							disabled={disabled}
							onClick={(event) => {
								event.preventDefault();
								onConfirm();
							}}
						>
							{confirmLabel}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	return (
		<Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
			<DialogContent closeLabel={tCommon("close")}>
				<form
					className="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						if (!disabled) onConfirm();
					}}
				>
					<DialogHeader>
						<DialogTitle>{title}</DialogTitle>
						<DialogDescription>{description}</DialogDescription>
					</DialogHeader>
					{children ? <div className="space-y-4">{children}</div> : null}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={busy}
							onClick={onClose}
						>
							{tCommon("cancel")}
						</Button>
						<Button type="submit" disabled={disabled}>
							{confirmLabel}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
