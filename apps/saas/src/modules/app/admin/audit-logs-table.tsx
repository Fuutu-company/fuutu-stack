"use client";

import { Button, Card, CardContent } from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

export function AuditLogsTable() {
	const t = useTranslations();
	const locale = useLocale();
	const [page, setPage] = useState(1);
	const query = useQuery(
		orpc.admin.auditLogs.list.queryOptions({
			input: { page, pageSize: 50 },
		}),
	);

	if (query.isLoading) {
		return (
			<p className="text-muted-foreground text-sm">{t("common.loading")}</p>
		);
	}
	if (query.isError) {
		return <p className="text-destructive text-sm">{t("common.error")}</p>;
	}

	const data = query.data;
	if (!data || data.items.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				{t("admin.auditLogs.empty")}
			</p>
		);
	}

	return (
		<Card>
			<CardContent className="space-y-4 p-6">
				<div className="overflow-hidden rounded-lg border">
					<table className="w-full text-sm">
						<thead className="bg-muted/50">
							<tr className="text-left">
								<th className="p-3 font-medium">
									{t("admin.auditLogs.col.time")}
								</th>
								<th className="p-3 font-medium">
									{t("admin.auditLogs.col.action")}
								</th>
								<th className="p-3 font-medium">
									{t("admin.auditLogs.col.user")}
								</th>
								<th className="p-3 font-medium">
									{t("admin.auditLogs.col.ip")}
								</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{data.items.map((log) => (
								<tr key={log.id}>
									<td className="p-3 text-muted-foreground text-xs">
										{new Date(log.createdAt).toLocaleString(locale)}
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
											t("common.notAvailable")
										)}
									</td>
									<td className="p-3 text-muted-foreground text-xs">
										{log.ip ?? t("common.notAvailable")}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className="flex items-center justify-between">
					<p className="text-muted-foreground text-xs">
						{t("admin.auditLogs.page", { page: data.page, total: data.total })}
					</p>
					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onClick={() => setPage((p) => Math.max(1, p - 1))}
						>
							{t("admin.auditLogs.prev")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={page >= data.totalPages}
							onClick={() => setPage((p) => p + 1)}
						>
							{t("admin.auditLogs.next")}
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
