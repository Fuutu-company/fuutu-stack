"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@fuutu/ui";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function ApiKeyCreatedDialog({
	apiKey,
	open,
	onClose,
}: {
	apiKey: string | null;
	open: boolean;
	onClose: () => void;
}) {
	const t = useTranslations("apiKeys");
	const [copied, setCopied] = useState(false);

	async function copyKey() {
		if (!apiKey) return;
		await navigator.clipboard.writeText(apiKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(v) => {
				if (!v) onClose();
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>{t("createdDialog.title")}</DialogTitle>
					<DialogDescription>
						{t("createdDialog.description")}
					</DialogDescription>
				</DialogHeader>
				<div className="flex items-center gap-2 rounded-md border bg-muted p-3">
					<code className="flex-1 truncate font-mono text-sm">{apiKey}</code>
					<Button type="button" variant="outline" size="sm" onClick={copyKey}>
						{copied ? (
							<Check className="size-4" />
						) : (
							<Copy className="size-4" />
						)}
						{copied ? t("createdDialog.copied") : t("createdDialog.copy")}
					</Button>
				</div>
				<DialogFooter>
					<Button type="button" onClick={onClose}>
						{t("createdDialog.done")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
