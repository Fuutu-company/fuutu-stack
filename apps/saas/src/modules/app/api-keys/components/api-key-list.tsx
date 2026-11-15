"use client";

import type { ApiKeyScope } from "@fuutu/api/api-key-scopes";
import {
	AreaIcon,
	Badge,
	Button,
	Card,
	CardContent,
	PageHeader,
} from "@fuutu/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useId } from "react";
import { useFullOrganization } from "@/modules/app/organizations/use-full-organization";
import { orpc } from "@/utils/orpc";
import type { ApiKeyOrgOption } from "./api-key-create-dialog";
import { ApiKeyRevokeDialog } from "./api-key-revoke-dialog";
import { CreateApiKeyButton } from "./create-api-key-button";

/** Rows per request — the API maximum (`apiKeys.list` `limit`). */
const PAGE_SIZE = 100;

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
	/** Whether the viewer may revoke it (server-computed). */
	canRevoke: boolean;
};

type FullOrg = {
	id: string;
	name: string;
	slug: string;
};

type KeyStatus = "active" | "revoked" | "expired";

function getKeyStatus(key: Pick<ApiKey, "revokedAt" | "expiresAt">): KeyStatus {
	if (key.revokedAt) return "revoked";
	if (key.expiresAt && new Date(key.expiresAt) < new Date()) return "expired";
	return "active";
}

/** Key status badge — shared by every key list (API keys, app keys). */
export function ApiKeyStatusBadge({ status }: { status: KeyStatus }) {
	const t = useTranslations("apiKeys");
	return (
		<Badge variant={status === "active" ? "default" : "secondary"}>
			{t(`status.${status}`)}
		</Badge>
	);
}

export function ApiKeyList({
	slug,
	organizationId,
	orgs = [],
	isSystemAdmin = false,
	variant = "page",
	id,
	title,
	description,
	scope,
	manageHref,
	createdHint,
}: {
	slug?: string;
	organizationId?: string;
	/** User settings: orgs the user may create keys for (org picker). */
	orgs?: readonly ApiKeyOrgOption[];
	isSystemAdmin?: boolean;
	/**
	 * `page` (default): the settings page with its compact page header.
	 * `section`: an h2 region for embedding in another page (`title`,
	 * `description`, `id` for anchors).
	 */
	variant?: "page" | "section";
	id?: string;
	/** Section heading (caller-translated). Default: `apiKeys.title`. */
	title?: ReactNode;
	description?: ReactNode;
	/** Only keys carrying this scope; new keys are preset to it. */
	scope?: ApiKeyScope;
	/** Renders an "All keys" link, e.g. to the org's key settings. */
	manageHref?: string;
	/** Next step under a revealed key, e.g. where to store it. */
	createdHint?: (scopes: readonly ApiKeyScope[]) => ReactNode;
}) {
	const t = useTranslations("apiKeys");
	const locale = useLocale();
	const titleId = useId();
	// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
	const org = (useFullOrganization(slug).data ?? null) as FullOrg | null;

	const effectiveOrgId = organizationId ?? org?.id;

	const query = useInfiniteQuery(
		orpc.apiKeys.list.infiniteOptions({
			input: (page: number) => ({
				...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
				...(scope ? { scope } : {}),
				page,
				limit: PAGE_SIZE,
			}),
			initialPageParam: 1,
			getNextPageParam: (last) =>
				last.page < last.totalPages ? last.page + 1 : undefined,
		}),
	);

	const items: ApiKey[] = query.data?.pages.flatMap((page) => page.items) ?? [];
	const refetch = () => void query.refetch();
	const createButton = (
		<CreateApiKeyButton
			organizationId={effectiveOrgId}
			orgs={orgs}
			isSystemAdmin={isSystemAdmin}
			presetScopes={scope ? [scope] : undefined}
			createdHint={createdHint}
			onCreated={refetch}
		/>
	);

	const orgNames = new Map(orgs.map((o) => [o.id, o.name]));

	function scopeLabel(scope: string): string {
		return t.has(`scopes.${scope}`) ? t(`scopes.${scope}`) : scope;
	}

	function formatDate(date: Date | null): string {
		if (!date) return t("neverUsed");
		return date.toLocaleDateString(locale);
	}

	const manageLink = manageHref ? (
		<Button asChild variant="ghost">
			<Link href={manageHref}>{t("allKeys")}</Link>
		</Button>
	) : null;

	const body = (
		<>
			{query.isLoading ? (
				<p className="text-muted-foreground text-sm">{t("loading")}</p>
			) : query.isError ? (
				<p className="text-destructive text-sm">{t("failed")}</p>
			) : items.length === 0 ? (
				<Card className="py-0">
					<CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
						<AreaIcon area="api">
							<KeyRound />
						</AreaIcon>
						<p className="font-bold font-heading">{t("empty")}</p>
						<p className="text-muted-foreground text-sm">
							{t("emptyDescription")}
						</p>
						{createButton}
					</CardContent>
				</Card>
			) : (
				<Card className="overflow-hidden py-0">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-muted/50">
								<tr className="text-left">
									<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
										{t("col.name")}
									</th>
									<th className="hidden whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs sm:table-cell">
										{t("col.prefix")}
									</th>
									<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
										{t("col.scopes")}
									</th>
									<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
										{t("col.lastUsed")}
									</th>
									<th className="hidden whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs md:table-cell">
										{t("col.createdAt")}
									</th>
									<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
										{t("col.status")}
									</th>
									<th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-muted-foreground text-xs">
										{t("col.actions")}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y">
								{items.map((key) => {
									const status = getKeyStatus(key);
									return (
										<tr key={key.id}>
											<td className="px-4 py-3 font-medium">
												{key.name}
												{!effectiveOrgId &&
													key.organizationId &&
													orgNames.has(key.organizationId) && (
														<span className="block font-normal text-muted-foreground text-xs">
															{orgNames.get(key.organizationId)}
														</span>
													)}
											</td>
											<td className="hidden px-4 py-3 font-mono text-muted-foreground text-xs sm:table-cell">
												{key.prefix}
											</td>
											<td className="px-4 py-3">
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
											<td className="px-4 py-3 text-muted-foreground text-xs">
												{formatDate(key.lastUsedAt)}
											</td>
											<td className="hidden px-4 py-3 text-muted-foreground text-xs md:table-cell">
												{formatDate(key.createdAt)}
											</td>
											<td className="px-4 py-3">
												<ApiKeyStatusBadge status={status} />
											</td>
											<td className="px-4 py-3 text-right">
												{status === "active" && key.canRevoke && (
													<ApiKeyRevokeDialog
														apiKeyId={key.id}
														onRevoked={refetch}
													/>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</Card>
			)}

			{query.hasNextPage && (
				<div className="flex justify-center">
					<Button
						variant="outline"
						onClick={() => void query.fetchNextPage()}
						disabled={query.isFetchingNextPage}
					>
						{query.isFetchingNextPage ? t("loading") : t("loadMore")}
					</Button>
				</div>
			)}
		</>
	);

	if (variant === "section") {
		return (
			<section id={id} aria-labelledby={titleId} className="space-y-4">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0 space-y-1">
						<h2
							id={titleId}
							className="font-bold font-heading text-lg tracking-heading"
						>
							{title ?? t("title")}
						</h2>
						{description ? (
							<p className="text-muted-foreground text-sm">{description}</p>
						) : null}
					</div>
					<div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
						{manageLink}
						{createButton}
					</div>
				</div>
				{body}
			</section>
		);
	}

	return (
		<div id={id} className="space-y-6">
			<PageHeader
				variant="compact"
				title={t("title")}
				actions={
					manageLink ? (
						<>
							{manageLink}
							{createButton}
						</>
					) : (
						createButton
					)
				}
			/>
			{body}
		</div>
	);
}
