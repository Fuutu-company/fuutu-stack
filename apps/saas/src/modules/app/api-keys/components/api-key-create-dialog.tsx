"use client";

import {
	API_KEY_ADMIN_SCOPES,
	API_KEY_SCOPES,
	type ApiKeyScope,
} from "@fuutu/api/api-key-scopes";
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

/** An org the user may create keys for (user settings org picker). */
export type ApiKeyOrgOption = { id: string; name: string };

/**
 * "personal" → user-owned key · "org" → unrestricted org credential ·
 * a scope → org key limited to that surface.
 */
type KeyType = "personal" | "org" | ApiKeyScope;

const log = createLogger({ scope: "api-keys" });

export function ApiKeyCreateDialog({
	organizationId,
	orgs = [],
	isSystemAdmin = false,
	onCreated,
}: {
	/** Fixed org context (org settings page) — no picker, no personal keys. */
	organizationId?: string;
	/** Orgs offered in the picker when there is no fixed org (user settings). */
	orgs?: readonly ApiKeyOrgOption[];
	/** Shows admin-only scopes — UI only, the API enforces it (FORBIDDEN). */
	isSystemAdmin?: boolean;
	onCreated: (key: ApiKeyResult) => void;
}) {
	const t = useTranslations("apiKeys");
	const tRoot = useTranslations();
	const tCommon = useTranslations("common");
	const offeredScopes = API_KEY_SCOPES.filter(
		(scope) => isSystemAdmin || !API_KEY_ADMIN_SCOPES.includes(scope),
	);
	const defaultType: KeyType = organizationId
		? (offeredScopes[0] ?? "org")
		: "personal";
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [type, setType] = useState<KeyType>(defaultType);
	const [pickedOrgId, setPickedOrgId] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// The org id can resolve after mount (loaded async by the parent) —
	// re-apply the context default when it changes.
	useEffect(() => {
		setType(defaultType);
	}, [defaultType]);

	const canCreateOrgKeys = Boolean(organizationId) || orgs.length > 0;
	const isOrgKey = type !== "personal";
	// A stale pick (org list changed) falls back to the first offered org.
	const targetOrgId =
		organizationId ??
		(orgs.some((org) => org.id === pickedOrgId) ? pickedOrgId : orgs[0]?.id);
	const scope = API_KEY_SCOPES.find((s) => s === type);
	const canSubmit =
		name.trim().length > 0 && (!isOrgKey || Boolean(targetOrgId));

	function scopeLabel(value: string): string {
		return t.has(`scopes.${value}`) ? t(`scopes.${value}`) : value;
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!canSubmit) return;
		setCreating(true);
		setError(null);
		try {
			const result = await orpc.apiKeys.create.call({
				name,
				...(isOrgKey && targetOrgId ? { organizationId: targetOrgId } : {}),
				...(scope ? { scopes: [scope] } : {}),
				...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
			});
			setOpen(false);
			setName("");
			setExpiresAt("");
			setType(defaultType);
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
						<Select value={type} onValueChange={(v) => setType(v as KeyType)}>
							<SelectTrigger id="api-key-type" className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{!organizationId && (
									<SelectItem value="personal">
										{t("createDialog.types.personal")}
									</SelectItem>
								)}
								{/* Scopes are an org-key concept — the API rejects them on personal keys. */}
								{canCreateOrgKeys && (
									<SelectItem value="org">
										{t("createDialog.types.org")}
									</SelectItem>
								)}
								{canCreateOrgKeys &&
									offeredScopes.map((value) => (
										<SelectItem key={value} value={value}>
											{scopeLabel(value)}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
						{isOrgKey && (
							<p className="text-muted-foreground text-xs">
								{t("createDialog.orgKeyHint")}
							</p>
						)}
					</Field>
					{!organizationId && isOrgKey && (
						<Field>
							<FieldLabel htmlFor="api-key-org">
								{t("createDialog.orgLabel")}
							</FieldLabel>
							<Select value={targetOrgId ?? ""} onValueChange={setPickedOrgId}>
								<SelectTrigger id="api-key-org" className="w-full">
									<SelectValue placeholder={t("createDialog.orgPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									{orgs.map((org) => (
										<SelectItem key={org.id} value={org.id}>
											{org.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
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
						<Button type="submit" disabled={creating || !canSubmit}>
							{creating ? t("creating") : t("createDialog.submit")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
