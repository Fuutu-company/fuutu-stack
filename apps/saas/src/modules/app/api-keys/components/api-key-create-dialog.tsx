"use client";

import {
	API_KEY_ADMIN_SCOPES,
	API_KEY_DEFAULT_SCOPES,
	API_KEY_SCOPES,
	type ApiKeyScope,
} from "@fuutu/api/api-key-scopes";
import { createLogger } from "@fuutu/logs";
import {
	Button,
	Checkbox,
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
	Label,
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

/** "personal" → user-owned key · "org" → organization key carrying scopes. */
type KeyType = "personal" | "org";

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
	const defaultType: KeyType = organizationId ? "org" : "personal";
	const defaultScopes = offeredScopes.filter((scope) =>
		API_KEY_DEFAULT_SCOPES.includes(scope),
	);
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [expiresAt, setExpiresAt] = useState("");
	const [type, setType] = useState<KeyType>(defaultType);
	const [selectedScopes, setSelectedScopes] =
		useState<readonly ApiKeyScope[]>(defaultScopes);
	const [pickedOrgId, setPickedOrgId] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// The org id can resolve after mount (loaded async by the parent) —
	// re-apply the context default when it changes.
	useEffect(() => {
		setType(defaultType);
	}, [defaultType]);

	const canCreateOrgKeys = Boolean(organizationId) || orgs.length > 0;
	const isOrgKey = type === "org";
	// A stale pick (org list changed) falls back to the first offered org.
	const targetOrgId =
		organizationId ??
		(orgs.some((org) => org.id === pickedOrgId) ? pickedOrgId : orgs[0]?.id);
	// Only offered scopes count (an admin-only default is dropped for others).
	const scopes = offeredScopes.filter((scope) =>
		selectedScopes.includes(scope),
	);
	// New keys need >= 1 scope. The API itself still accepts an empty list so
	// existing unscoped keys keep working as full oRPC/REST credentials.
	const canSubmit =
		name.trim().length > 0 &&
		(!isOrgKey || (Boolean(targetOrgId) && scopes.length > 0));

	function scopeLabel(value: string): string {
		return t.has(`scopes.${value}`) ? t(`scopes.${value}`) : value;
	}

	function toggleScope(value: ApiKeyScope, checked: boolean) {
		setSelectedScopes(
			checked
				? [...selectedScopes.filter((s) => s !== value), value]
				: selectedScopes.filter((s) => s !== value),
		);
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
				...(isOrgKey ? { scopes } : {}),
				...(expiresAt ? { expiresAt: new Date(expiresAt) } : {}),
			});
			setOpen(false);
			setName("");
			setExpiresAt("");
			setType(defaultType);
			setSelectedScopes(defaultScopes);
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
					{!organizationId && canCreateOrgKeys && (
						<Field>
							<FieldLabel htmlFor="api-key-type">
								{t("createDialog.typeLabel")}
							</FieldLabel>
							<Select value={type} onValueChange={(v) => setType(v as KeyType)}>
								<SelectTrigger id="api-key-type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="personal">
										{t("createDialog.types.personal")}
									</SelectItem>
									<SelectItem value="org">
										{t("createDialog.types.org")}
									</SelectItem>
								</SelectContent>
							</Select>
						</Field>
					)}
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
					{isOrgKey && (
						<fieldset className="space-y-2">
							<legend className="font-medium text-sm">
								{t("createDialog.scopesLabel")}
							</legend>
							<p className="text-muted-foreground text-xs">
								{t("createDialog.orgKeyHint")}
							</p>
							<div className="space-y-2">
								{offeredScopes.map((value) => (
									<div key={value} className="flex items-start gap-3">
										<Checkbox
											id={`api-key-scope-${value}`}
											className="mt-0.5"
											checked={scopes.includes(value)}
											onCheckedChange={(checked) =>
												toggleScope(value, checked === true)
											}
											aria-describedby={`api-key-scope-${value}-description`}
										/>
										<div className="space-y-0.5">
											<Label htmlFor={`api-key-scope-${value}`}>
												{scopeLabel(value)}
											</Label>
											{t.has(`scopeDescriptions.${value}`) && (
												<p
													id={`api-key-scope-${value}-description`}
													className="text-muted-foreground text-xs"
												>
													{t(`scopeDescriptions.${value}`)}
												</p>
											)}
										</div>
									</div>
								))}
							</div>
						</fieldset>
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
