"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
	Card,
	CardContent,
	Input,
} from "@fuutu/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { orpc } from "@/utils/orpc";
import { AdminPagination } from "./admin-pagination";
import { initials } from "./admin-user-utils";
import { OrgPlan } from "./org-plan";

const SORT_KEYS = ["createdAt", "name", "members"] as const;
type SortKey = (typeof SORT_KEYS)[number];

const SEARCH_DEBOUNCE_MS = 300;

function parseSort(value: string | null): SortKey {
	return SORT_KEYS.find((key) => key === value) ?? "createdAt";
}

function parsePage(value: string | null): number {
	const page = Number.parseInt(value ?? "", 10);
	return Number.isFinite(page) && page >= 1 ? page : 1;
}

export function AdminOrganizationsTable() {
	const t = useTranslations("admin.organizations");
	const tStatus = useTranslations("admin.userDetail.billing.statusValue");
	const format = useFormatter();
	const router = useRouter();
	const pathname = usePathname();
	const params = useSearchParams();

	const q = params.get("q") ?? "";
	const sort = parseSort(params.get("sort"));
	const dir = params.get("dir") === "asc" ? "asc" : "desc";
	const page = parsePage(params.get("page"));

	function update(patch: Record<string, string | undefined>) {
		const next = new URLSearchParams(params.toString());
		for (const [key, value] of Object.entries(patch)) {
			if (value === undefined || value === "") next.delete(key);
			else next.set(key, value);
		}
		const qs = next.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	}

	const [search, setSearch] = useState(q);
	// biome-ignore lint/correctness/useExhaustiveDependencies: `update` is rebuilt every render; only the typed text and URL value matter.
	useEffect(() => {
		if (search.trim() === q) return;
		const timer = setTimeout(
			() => update({ q: search.trim() || undefined, page: undefined }),
			SEARCH_DEBOUNCE_MS,
		);
		return () => clearTimeout(timer);
	}, [search, q]);

	const query = useQuery({
		...orpc.admin.organizations.list.queryOptions({
			input: { q: q || undefined, sort, dir, page, pageSize: 25 },
		}),
		placeholderData: keepPreviousData,
	});

	function toggleSort(key: SortKey) {
		if (sort === key) {
			update({ dir: dir === "asc" ? "desc" : "asc", page: undefined });
		} else {
			update({
				sort: key,
				dir: key === "name" ? "asc" : "desc",
				page: undefined,
			});
		}
	}

	function sortHeader(key: SortKey, label: string) {
		const active = sort === key;
		const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
		return (
			<th
				scope="col"
				aria-sort={
					active ? (dir === "asc" ? "ascending" : "descending") : "none"
				}
				className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs"
			>
				<button
					type="button"
					onClick={() => toggleSort(key)}
					className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
				>
					{label}
					<Icon aria-hidden="true" className="size-3" />
				</button>
			</th>
		);
	}

	const data = query.data;

	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="space-y-4 p-6">
				<div className="relative">
					<Search
						aria-hidden="true"
						className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder={t("searchPlaceholder")}
						aria-label={t("searchLabel")}
						className="pl-9"
					/>
				</div>

				{query.isError ? (
					<p role="alert" className="text-destructive text-sm">
						{t("loadError")}
					</p>
				) : !data ? (
					<p className="text-muted-foreground text-sm">{t("loading")}</p>
				) : data.items.length === 0 ? (
					<p className="text-muted-foreground text-sm">{t("empty")}</p>
				) : (
					<>
						<div className="-mx-6 overflow-x-auto border-t">
							<table className="w-full text-sm">
								<caption className="sr-only">{t("title")}</caption>
								<thead className="bg-muted/50">
									<tr className="text-left">
										{sortHeader("name", t("organization"))}
										{sortHeader("members", t("members"))}
										<th
											scope="col"
											className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs"
										>
											{t("invitations")}
										</th>
										<th
											scope="col"
											className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs"
										>
											{t("plan")}
										</th>
										{sortHeader("createdAt", t("createdAt"))}
									</tr>
								</thead>
								<tbody className="divide-y">
									{data.items.map((org) => (
										<tr key={org.id} className="hover:bg-muted/30">
											<td className="px-4 py-3">
												<Link
													href={`/admin/organizations/${org.id}`}
													className="flex items-center gap-3 rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
												>
													<Avatar className="size-8">
														{org.logo ? (
															<AvatarImage src={org.logo} alt="" />
														) : null}
														<AvatarFallback className="text-xs">
															{initials(org.name, org.slug)}
														</AvatarFallback>
													</Avatar>
													<span className="min-w-0">
														<span className="block truncate font-medium">
															{org.name}
														</span>
														<span className="block truncate text-muted-foreground text-xs">
															{org.slug}
														</span>
													</span>
												</Link>
											</td>
											<td className="px-4 py-3 text-xs">{org.memberCount}</td>
											<td className="px-4 py-3 text-xs">
												{org.pendingInvitationCount}
											</td>
											<td className="px-4 py-3">
												<OrgPlan
													subscription={org.activeSubscription}
													statusLabel={(status) =>
														tStatus.has(status) ? tStatus(status) : status
													}
												/>
											</td>
											<td
												className="whitespace-nowrap px-4 py-3 text-muted-foreground text-xs"
												data-volatile
											>
												{format.dateTime(org.createdAt, {
													dateStyle: "medium",
												})}
											</td>
										</tr>
									))}
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
