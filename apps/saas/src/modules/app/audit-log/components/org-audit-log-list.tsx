"use client";

import { Button, Card, CardContent, PageHeader } from "@fuutu/ui";
import { ScrollText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import {
	type AuditLogActionFilter,
	AuditLogFilters,
} from "./audit-log-filters";

type AuditLog = {
	id: string;
	userId: string | null;
	action: string;
	ip: string | null;
	metadata: unknown;
	createdAt: Date;
	userAgent: string | null;
	user: { id: string; email: string; name: string | null } | null;
};

type Labels = {
	title: string;
	empty: string;
	colTime: string;
	colAction: string;
	colUser: string;
	colIp: string;
	pageLabel: string;
	prev: string;
	next: string;
	notAvailable: string;
};

interface Props {
	slug: string;
	logs: AuditLog[];
	total: number;
	page: number;
	pageSize: number;
	filter: AuditLogActionFilter;
	labels: Labels;
}

export function OrgAuditLogList({
	slug,
	logs,
	total,
	page,
	pageSize,
	filter,
	labels,
}: Props) {
	const router = useRouter();
	const locale = useLocale();
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	function updateQuery(next: Partial<{ filter: string; page: string }>) {
		const params = new URLSearchParams();
		if (filter !== "all") params.set("filter", filter);
		if (page > 1) params.set("page", String(page));
		for (const [k, v] of Object.entries(next)) {
			if (v) params.set(k, v);
			else params.delete(k);
		}
		const qs = params.toString();
		router.push(
			`/organizations/${slug}/settings/audit-log${qs ? `?${qs}` : ""}`,
		);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				variant="compact"
				title={labels.title}
				actions={
					<AuditLogFilters
						value={filter}
						onChange={(value) => updateQuery({ filter: value, page: "" })}
					/>
				}
			/>

			<Card className="overflow-hidden py-0">
				<CardContent className="space-y-4 p-6">
					{logs.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
							<span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
								<ScrollText className="size-[1.125rem]" />
							</span>
							<p className="text-muted-foreground text-sm">{labels.empty}</p>
						</div>
					) : (
						<div className="-mx-6 -mt-6 overflow-x-auto border-b">
							<table className="w-full text-sm">
								<thead className="bg-muted/50">
									<tr className="text-left">
										<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
											{labels.colTime}
										</th>
										<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
											{labels.colAction}
										</th>
										<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
											{labels.colUser}
										</th>
										<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
											{labels.colIp}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{logs.map((log) => (
										<tr key={log.id}>
											<td
												className="p-3 text-muted-foreground text-xs"
												data-volatile
											>
												{log.createdAt.toLocaleString(locale)}
											</td>
											<td className="px-4 py-3 font-mono text-xs">
												{log.action}
											</td>
											<td className="px-4 py-3 text-xs">
												{log.user ? (
													<div>
														<div className="font-medium">
															{log.user.name ?? log.user.email}
														</div>
														{log.user.name && (
															<div className="text-muted-foreground text-xs">
																{log.user.email}
															</div>
														)}
													</div>
												) : (
													labels.notAvailable
												)}
											</td>
											<td
												className="p-3 text-muted-foreground text-xs"
												data-volatile
											>
												{log.ip ?? labels.notAvailable}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
					{total > pageSize && (
						<div className="flex items-center justify-between">
							<p className="text-muted-foreground text-xs">
								{labels.pageLabel}
							</p>
							<div className="flex gap-2">
								<Button
									variant="outline"
									size="sm"
									disabled={page <= 1}
									onClick={() =>
										updateQuery({ page: String(Math.max(1, page - 1)) })
									}
								>
									{labels.prev}
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={page >= totalPages}
									onClick={() => updateQuery({ page: String(page + 1) })}
								>
									{labels.next}
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
