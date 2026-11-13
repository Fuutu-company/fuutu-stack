"use client";

import { Badge, Card, CardContent } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { useFullOrganization } from "@/modules/app/organizations/use-full-organization";
import { orpc } from "@/utils/orpc";
import {
	ApiKeyCreateDialog,
	type ApiKeyOrgOption,
} from "./api-key-create-dialog";
import { ApiKeyCreatedDialog } from "./api-key-created-dialog";
import { ApiKeyRevokeDialog } from "./api-key-revoke-dialog";

type ApiKey = {
	id: string;
	name: string;
	prefix: string;
	scopes: string[];
	organizationId: string | null;
	lastUsedAt: Date | null;
	createdAt: Date;
	revokedAt: Date | null;
	expiresAt: Date | null;
};

type FullOrg = {
	id: string;
	name: string;
	slug: string;
};

type CreatedKey = {
	id: string;
	key: string;
	prefix: string;
};

function getKeyStatus(key: ApiKey): "active" | "revoked" | "expired" {
	if (key.revokedAt) return "revoked";
	if (key.expiresAt && new Date(key.expiresAt) < new Date()) return "expired";
	return "active";
}

export function ApiKeyList({
	slug,
	organizationId,
	orgs = [],
	isSystemAdmin = false,
}: {
	slug?: string;
	organizationId?: string;
	/** User settings: orgs the user may create keys for (org picker). */
	orgs?: readonly ApiKeyOrgOption[];
	isSystemAdmin?: boolean;
}) {
	const t = useTranslations("apiKeys");
	const locale = useLocale();
	// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
	const org = (useFullOrganization(slug).data ?? null) as FullOrg | null;
	const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);

	const effectiveOrgId = organizationId ?? org?.id;

	const query = useQuery(
		orpc.apiKeys.list.queryOptions({
			input: { ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}) },
		}),
	);

	const items = query.data?.items ?? [];

	const orgNames = new Map(orgs.map((o) => [o.id, o.name]));

	function scopeLabel(scope: string): string {
		return t.has(`scopes.${scope}`) ? t(`scopes.${scope}`) : scope;
	}

	function formatDate(date: Date | null): string {
		if (!date) return t("neverUsed");
		return date.toLocaleDateString(locale);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						{t("description")}
					</p>
				</div>
				<ApiKeyCreateDialog
					organizationId={effectiveOrgId}
					orgs={orgs}
					isSystemAdmin={isSystemAdmin}
					onCreated={(key) => setCreatedKey(key)}
				/>
			</div>

			{query.isLoading ? (
				<p className="text-muted-foreground text-sm">{t("loading")}</p>
			) : query.isError ? (
				<p className="text-destructive text-sm">{t("failed")}</p>
			) : items.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
						<KeyRound className="size-8 text-muted-foreground" />
						<p className="font-medium text-sm">{t("empty")}</p>
						<p className="text-muted-foreground text-sm">
							{t("emptyDescription")}
						</p>
						<ApiKeyCreateDialog
							organizationId={effectiveOrgId}
							orgs={orgs}
							isSystemAdmin={isSystemAdmin}
							onCreated={(key) => setCreatedKey(key)}
						/>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className="p-6">
						<div className="overflow-hidden rounded-lg border">
							<table className="w-full text-sm">
								<thead className="bg-muted/50">
									<tr className="text-left">
										<th className="p-3 font-medium">{t("col.name")}</th>
										<th className="p-3 font-medium">{t("col.prefix")}</th>
										<th className="p-3 font-medium">{t("col.scopes")}</th>
										<th className="p-3 font-medium">{t("col.lastUsed")}</th>
										<th className="p-3 font-medium">{t("col.createdAt")}</th>
										<th className="p-3 font-medium">{t("col.status")}</th>
										<th className="p-3 text-right font-medium">
											{t("col.actions")}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{items.map((key: ApiKey) => {
										const status = getKeyStatus(key);
										return (
											<tr key={key.id}>
												<td className="p-3 font-medium">
													{key.name}
													{!effectiveOrgId &&
														key.organizationId &&
														orgNames.has(key.organizationId) && (
															<span className="block font-normal text-muted-foreground text-xs">
																{orgNames.get(key.organizationId)}
															</span>
														)}
												</td>
												<td className="p-3 font-mono text-muted-foreground text-xs">
													{key.prefix}
												</td>
												<td className="p-3">
													<div className="flex flex-wrap gap-1">
														{key.scopes.length === 0 ? (
															<Badge variant="secondary">
																{key.organizationId
																	? t("scopes.full")
																	: t("scopes.personal")}
															</Badge>
														) : (
															key.scopes.map((scope) => (
																<Badge key={scope} variant="secondary">
																	{scopeLabel(scope)}
																</Badge>
															))
														)}
													</div>
												</td>
												<td className="p-3 text-muted-foreground text-xs">
													{formatDate(key.lastUsedAt)}
												</td>
												<td className="p-3 text-muted-foreground text-xs">
													{formatDate(key.createdAt)}
												</td>
												<td className="p-3">
													<Badge
														variant={
															status === "active" ? "default" : "secondary"
														}
													>
														{t(`status.${status}`)}
													</Badge>
												</td>
												<td className="p-3 text-right">
													{status === "active" && (
														<ApiKeyRevokeDialog
															apiKeyId={key.id}
															onRevoked={() => void query.refetch()}
														/>
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			)}

			<ApiKeyCreatedDialog
				apiKey={createdKey?.key ?? null}
				open={createdKey !== null}
				onClose={() => {
					setCreatedKey(null);
					void query.refetch();
				}}
			/>
		</div>
	);
}
