"use client";

import { createLogger } from "@fuutu/logs";
import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Field,
	FieldLabel,
	Input,
} from "@fuutu/ui";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

type ApiKeyResult = {
	id: string;
	key: string;
	prefix: string;
};

const log = createLogger({ scope: "api-keys" });

export function ApiKeyCreateDialog({
	organizationId,
	onCreated,
}: {
	organizationId?: string;
	onCreated: (key: ApiKeyResult) => void;
}) {
	const t = useTranslations("apiKeys");
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setCreating(true);
		setError(null);
		try {
			const result = await orpc.apiKeys.create.call({
				name,
				...(organizationId ? { organizationId } : {}),
				...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
			});
			setOpen(false);
			setName("");
			setExpiresAt("");
			onCreated(result);
		} catch (e) {
			log.error("api key creation failed", { err: e });
			setError(t("failed"));
		} finally {
			setCreating(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button>
					<Plus className="size-4" />
					{t("create")}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={submit} className="space-y-4">
					<DialogHeader>
						<DialogTitle>{t("createDialog.title")}</DialogTitle>
						<DialogDescription>
							{t("createDialog.description")}
						</DialogDescription>
					</DialogHeader>
					<Field>
						<FieldLabel htmlFor="api-key-name">
							{t("createDialog.nameLabel")}
						</FieldLabel>
						<Input
							id="api-key-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t("createDialog.namePlaceholder")}
							required
						/>
					</Field>
					<Field>
						<FieldLabel htmlFor="api-key-expiry">
							{t("createDialog.expiryLabel")}
						</FieldLabel>
						<Input
							id="api-key-expiry"
							type="date"
							value={expiresAt}
							onChange={(e) => setExpiresAt(e.target.value)}
							placeholder={t("createDialog.expiryPlaceholder")}
						/>
					</Field>
					{error && <p className="text-destructive text-sm">{error}</p>}
					<DialogFooter>
						<Button type="submit" disabled={creating || !name.trim()}>
							{creating ? t("creating") : t("createDialog.submit")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
