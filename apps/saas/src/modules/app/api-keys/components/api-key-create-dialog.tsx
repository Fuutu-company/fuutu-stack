"use client";

import { API_KEY_SCOPES } from "@fuutu/api/api-key-scopes";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { planGateMessage } from "@/lib/api-error";
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
	const tRoot = useTranslations();
	const tCommon = useTranslations("common");
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	// "personal" | "org" | one of API_KEY_SCOPES. Org context
	// defaults to the first scope option.
	const [type, setType] = useState<string>(
		organizationId ? API_KEY_SCOPES[0] : "personal",
	);
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// The org id can resolve after mount (loaded async by the parent) —
	// re-apply the context default when it changes.
	useEffect(() => {
		setType(organizationId ? API_KEY_SCOPES[0] : "personal");
	}, [organizationId]);

	const isScopeType = (API_KEY_SCOPES as readonly string[]).includes(type);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setCreating(true);
		setError(null);
		try {
			const result = await orpc.apiKeys.create.call({
				name,
				...(organizationId ? { organizationId } : {}),
				...(isScopeType ? { scopes: [type] } : {}),
				...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
			});
			setOpen(false);
			setName("");
			setExpiresAt("");
			setType(organizationId ? API_KEY_SCOPES[0] : "personal");
			onCreated(result);
		} catch (e) {
			log.error("api key creation failed", { err: e });
			setError(planGateMessage(e, tRoot, "apiKeys.failed"));
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
			<DialogContent closeLabel={tCommon("close")}>
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
						<FieldLabel htmlFor="api-key-type">
							{t("createDialog.typeLabel")}
						</FieldLabel>
						<Select value={type} onValueChange={setType}>
							<SelectTrigger id="api-key-type" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{!organizationId && (
									<SelectItem value="personal">
										{t("createDialog.types.personal")}
									</SelectItem>
								)}
								{organizationId && (
									<SelectItem value="org">
										{t("createDialog.types.org")}
									</SelectItem>
								)}
								{/* Scopes are an org-key concept — the API rejects them on personal keys. */}
								{organizationId &&
									API_KEY_SCOPES.map((scope) => (
										<SelectItem key={scope} value={scope}>
											{t(`scopes.${scope}`)}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
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
