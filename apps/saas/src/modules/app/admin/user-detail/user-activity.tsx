"use client";

import { Card, CardContent } from "@fuutu/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import { auditReason } from "../admin-audit-utils";
import { AdminPagination } from "../admin-pagination";

const PAGE_SIZE = 10;

export function UserActivity({ userId }: { userId: string }) {
	const t = useTranslations("admin.userDetail.activity");
	const tCommon = useTranslations("common");
	const format = useFormatter();
	const [page, setPage] = useState(1);
	const query = useQuery({
		...orpc.admin.auditLogs.list.queryOptions({
			input: { timelineUserId: userId, page, pageSize: PAGE_SIZE },
		}),
		placeholderData: keepPreviousData,
	});

	const data = query.data;
	return (
		<Card className="overflow-hidden py-0">
			<CardContent className="space-y-4 p-6">
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
						<ol className="space-y-4">
							{data.items.map((log) => {
								const reason = auditReason(log.metadata);
								return (
									<li key={log.id} className="space-y-1 border-l-2 pl-4">
										<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
											<span className="font-mono text-xs">{log.action}</span>
											<time
												dateTime={new Date(log.createdAt).toISOString()}
												className="text-muted-foreground text-xs"
												data-volatile
											>
												{format.dateTime(log.createdAt, {
													dateStyle: "medium",
													timeStyle: "short",
												})}
											</time>
										</div>
										<p className="text-muted-foreground text-xs">
											{t("by", {
												actor:
													log.user?.name ??
													log.user?.email ??
													tCommon("notAvailable"),
											})}
											{log.ip ? ` · ${log.ip}` : ""}
										</p>
										{reason ? (
											<p className="text-sm">{t("reason", { reason })}</p>
										) : null}
									</li>
								);
							})}
						</ol>
						<AdminPagination
							page={data.page}
							totalPages={data.totalPages}
							total={data.total}
							onPageChange={setPage}
						/>
					</>
				)}
			</CardContent>
		</Card>
	);
}
