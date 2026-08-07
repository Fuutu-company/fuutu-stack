"use client";

import { Button, Card, CardContent } from "@fuutu/ui";
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
	description: string;
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
			<div className="flex items-start justify-between gap-4">
				<div>
					<h1 className="font-bold text-3xl tracking-tight">{labels.title}</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						{labels.description}
					</p>
				</div>
				<AuditLogFilters
					value={filter}
					onChange={(value) => updateQuery({ filter: value, page: "" })}
				/>
			</div>

			<Card>
				<CardContent className="space-y-4 p-6">
					{logs.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
							<ScrollText className="size-8 text-muted-foreground" />
							<p className="text-muted-foreground text-sm">{labels.empty}</p>
						</div>
					) : (
						<div className="overflow-hidden rounded-lg border">
							<table className="w-full text-sm">
								<thead className="bg-muted/50">
									<tr className="text-left">
										<th className="p-3 font-medium">{labels.colTime}</th>
										<th className="p-3 font-medium">{labels.colAction}</th>
										<th className="p-3 font-medium">{labels.colUser}</th>
										<th className="p-3 font-medium">{labels.colIp}</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{logs.map((log) => (
										<tr key={log.id}>
											<td className="p-3 text-muted-foreground text-xs">
												{log.createdAt.toLocaleString(locale)}
											</td>
											<td className="p-3 font-mono text-xs">{log.action}</td>
											<td className="p-3 text-xs">
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
											<td className="p-3 text-muted-foreground text-xs">
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
