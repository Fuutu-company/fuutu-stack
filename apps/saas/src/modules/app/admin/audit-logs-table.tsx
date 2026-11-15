"use client";

import { Button, Card, CardContent, Input, Label } from "@fuutu/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";
import { orpc } from "@/utils/orpc";
import {
	auditReason,
	auditTargetOrganizationId,
	auditTargetUserId,
} from "./admin-audit-utils";
import { AdminPagination } from "./admin-pagination";
import { useDebouncedCommit } from "./use-debounced-commit";

const FILTER_KEYS = [
	"action",
	"actor",
	"targetUser",
	"targetOrg",
	"from",
	"to",
] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

const PAGE_SIZE = 50;
const SHORT_ID_LENGTH = 8;

const th =
	"whitespace-nowrap px-4 py-3 text-left font-semibold text-muted-foreground text-xs";

function parsePage(value: string | null): number {
	const page = Number.parseInt(value ?? "", 10);
	return Number.isFinite(page) && page >= 1 ? page : 1;
}

/** `YYYY-MM-DD` from the URL → a valid local-day boundary, or undefined. */
function parseDay(value: string, endOfDay: boolean): Date | undefined {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

function FilterField({
	label,
	value,
	placeholder,
	type = "text",
	debounce = true,
	onCommit,
}: {
	label: string;
	value: string;
	placeholder?: string;
	type?: "text" | "date";
	debounce?: boolean;
	onCommit: (value: string) => void;
}) {
	const id = useId();
	const [draft, setDraft] = useState(value);
	// Follow the URL when it changes elsewhere (clear filters, back button).
	useEffect(() => setDraft(value), [value]);
	useDebouncedCommit(draft, value, onCommit, debounce);

	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<Input
				id={id}
				type={type}
				value={draft}
				placeholder={placeholder}
				autoComplete="off"
				onChange={(e) => {
					setDraft(e.target.value);
					if (!debounce) onCommit(e.target.value);
				}}
			/>
		</div>
	);
}

export function AuditLogsTable() {
	const t = useTranslations("admin.auditLogs");
	const tCommon = useTranslations("common");
	const format = useFormatter();
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();

	const filters = Object.fromEntries(
		FILTER_KEYS.map((key) => [key, params.get(key) ?? ""]),
	) as Record<FilterKey, string>;
	const page = parsePage(params.get("page"));
	const hasFilters = FILTER_KEYS.some((key) => filters[key] !== "");

	function update(patch: Record<string, string | undefined>) {
		const next = new URLSearchParams(params.toString());
		for (const [key, value] of Object.entries(patch)) {
			if (value === undefined || value === "") next.delete(key);
			else next.set(key, value);
		}
		const qs = next.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	}

	const setFilter = (key: FilterKey) => (value: string) =>
		update({ [key]: value || undefined, page: undefined });

	const query = useQuery({
		...orpc.admin.auditLogs.list.queryOptions({
			input: {
				page,
				pageSize: PAGE_SIZE,
				actionPrefix: filters.action || undefined,
				actorUserId: filters.actor || undefined,
				targetUserId: filters.targetUser || undefined,
				targetOrganizationId: filters.targetOrg || undefined,
				from: parseDay(filters.from, false),
				to: parseDay(filters.to, true),
			},
		}),
		placeholderData: keepPreviousData,
	});

	const data = query.data;

	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="space-y-4 p-6">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<FilterField
						label={t("filters.actionPrefix")}
						placeholder={t("filters.actionPrefixPlaceholder")}
						value={filters.action}
						onCommit={setFilter("action")}
					/>
					<FilterField
						label={t("filters.actor")}
						value={filters.actor}
						onCommit={setFilter("actor")}
					/>
					<FilterField
						label={t("filters.targetUser")}
						value={filters.targetUser}
						onCommit={setFilter("targetUser")}
					/>
					<FilterField
						label={t("filters.targetOrganization")}
						value={filters.targetOrg}
						onCommit={setFilter("targetOrg")}
					/>
					<FilterField
						label={t("filters.from")}
						type="date"
						debounce={false}
						value={filters.from}
						onCommit={setFilter("from")}
					/>
					<FilterField
						label={t("filters.to")}
						type="date"
						debounce={false}
						value={filters.to}
						onCommit={setFilter("to")}
					/>
				</div>
				{hasFilters ? (
					<Button
						variant="ghost"
						size="sm"
						onClick={() =>
							update({
								...Object.fromEntries(
									FILTER_KEYS.map((key) => [key, undefined]),
								),
								page: undefined,
							})
						}
					>
						{t("filters.clear")}
					</Button>
				) : null}

				{query.isError ? (
					<p role="alert" className="text-destructive text-sm">
						{t("loadError")}
					</p>
				) : !data ? (
					<p className="text-muted-foreground text-sm">{tCommon("loading")}</p>
				) : data.items.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("empty")}</p>
				) : (
					<>
						<div className="-mx-6 overflow-x-auto border-t">
							<table className="w-full text-sm">
								<caption className="sr-only">{t("title")}</caption>
								<thead className="bg-muted/50">
									<tr>
										<th scope="col" className={th}>
											{t("col.time")}
										</th>
										<th scope="col" className={th}>
											{t("col.action")}
										</th>
										<th scope="col" className={th}>
											{t("col.user")}
										</th>
										<th scope="col" className={th}>
											{t("col.target")}
										</th>
										<th scope="col" className={th}>
											{t("col.ip")}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{data.items.map((log) => {
										const reason = auditReason(log.metadata);
										const targetUserId = auditTargetUserId(log.metadata);
										const targetOrgId =
											auditTargetOrganizationId(log.metadata) ??
											log.organizationId;
										return (
											<tr key={log.id}>
												<td
													className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
													data-volatile
												>
													{format.dateTime(log.createdAt, {
														dateStyle: "medium",
														timeStyle: "medium",
													})}
												</td>
												<td className="px-4 py-3">
													<span className="font-mono text-xs">
														{log.action}
													</span>
													{reason ? (
														<span className="mt-1 block text-muted-foreground text-xs">
															{t("reason", { reason })}
														</span>
													) : null}
												</td>
												<td className="px-4 py-3 text-xs">
													{log.user ? (
														<Link
															href={`/admin/users/${log.user.id}`}
															className="block rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
														>
															<span className="block font-medium">
																{log.user.name ?? log.user.email}
															</span>
															{log.user.name ? (
																<span className="block text-muted-foreground">
																	{log.user.email}
																</span>
															) : null}
														</Link>
													) : (
														tCommon("notAvailable")
													)}
												</td>
												<td className="px-4 py-3 text-xs">
													{targetUserId || targetOrgId ? (
														<span className="grid gap-1">
															{targetUserId ? (
																<TargetLink
																	label={t("user")}
																	href={`/admin/users/${targetUserId}`}
																	id={targetUserId}
																/>
															) : null}
															{targetOrgId ? (
																<TargetLink
																	label={t("organization")}
																	href={`/admin/organizations/${targetOrgId}`}
																	id={targetOrgId}
																/>
															) : null}
														</span>
													) : (
														tCommon("notAvailable")
													)}
												</td>
												<td
													className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
													data-volatile
												>
													{log.ip ?? tCommon("notAvailable")}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<AdminPagination
							page={data.page}
							totalPages={data.totalPages}
							total={data.total}
							onPageChange={(next) =>
								update({ page: next > 1 ? String(next) : undefined })
							}
						/>
					</>
				)}
			</CardContent>
		</Card>
	);
}

function TargetLink({
	label,
	href,
	id,
}: {
	label: string;
	href: string;
	id: string;
}) {
	return (
		<span className="flex items-baseline gap-2">
			<span className="text-muted-foreground">{label}</span>
			<Link
				href={href}
				title={id}
				className="rounded-sm font-mono underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
			>
				{id.slice(0, SHORT_ID_LENGTH)}
			</Link>
		</span>
	);
}
