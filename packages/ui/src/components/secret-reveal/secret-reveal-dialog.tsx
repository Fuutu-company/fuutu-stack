"use client";

import type { ReactNode } from "react";
import { Button } from "../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import { SecretField, type SecretFieldLabels } from "./secret-field";

export type SecretRevealDialogLabels = SecretFieldLabels & {
	/** Confirm button ("I've copied it"). */
	done: string;
	/** Accessible label of the X button. */
	close: string;
};

/**
 * Shows a secret exactly once (API key, license key, webhook signing
 * secret). The secret is rendered in full and wraps; a failed copy selects
 * it and shows `labels.copyFailed`. An outside click does not dismiss the
 * dialog — Esc, the X and the confirm button call `onClose`.
 */
export function SecretRevealDialog({
	open,
	secret,
	onClose,
	title,
	description,
	labels,
	children,
}: {
	open: boolean;
	secret: string | null;
	onClose: () => void;
	title: string;
	description: string;
	labels: SecretRevealDialogLabels;
	/** Next-step hint between the secret and the footer. */
	children?: ReactNode;
}) {
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent
				className="sm:max-w-md"
				closeLabel={labels.close}
				onInteractOutside={(event) => event.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				{secret !== null && <SecretField secret={secret} labels={labels} />}
				{children}
				<DialogFooter>
					<Button type="button" onClick={onClose}>
						{labels.done}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
