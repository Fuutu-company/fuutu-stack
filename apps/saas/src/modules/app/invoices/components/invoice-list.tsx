"use client";

import { authClient } from "@fuutu/auth/client";
import { createLogger } from "@fuutu/logs";
import {
	Button,
	Card,
	CardContent,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { orpc } from "@/utils/orpc";
import { InvoiceStatusBadge } from "./invoice-status-badge";

const log = createLogger({ scope: "invoice-list" });

type FullOrg = {
	id: string;
	name: string;
	slug: string;
};

type DateFilter = "all" | "last30" | "last90";

export function InvoiceList({ slug }: { slug?: string }) {
	const t = useTranslations("invoices");
	const locale = useLocale();
	const [org, setOrg] = useState<FullOrg | null>(null);
	const [dateFilter, setDateFilter] = useState<DateFilter>("all");

	const loadOrg = useCallback(async () => {
		if (!slug) return;
		try {
			const res = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			});
			// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
			const data = res.data as FullOrg | null;
			if (data) setOrg(data);
		} catch (e) {
			log.error("failed to load organization", { err: e });
		}
	}, [slug]);

	useEffect(() => {
		void loadOrg();
	}, [loadOrg]);

	const query = useQuery(
		orpc.payments.invoices.list.queryOptions({
			input: {
				page: 1,
				limit: 100,
				...(org?.id ? { organizationId: org.id } : {}),
			},
			enabled: slug ? org !== null : true,
		}),
	);

	// oRPC infers the Prisma Invoice type (amount is Decimal, serialized as string over JSON).
	const allInvoices = query.data?.items ?? [];

	const filteredInvoices = useMemo(() => {
		if (dateFilter === "all") return allInvoices;
		const days = dateFilter === "last30" ? 30 : 90;
		const cutoff = new Date();
		cutoff.setDate(cutoff.getDate() - days);
		return allInvoices.filter((inv) => inv.issuedAt >= cutoff);
	}, [allInvoices, dateFilter]);

	function formatAmount(amount: number, currency: string): string {
		return new Intl.NumberFormat(locale, {
			style: "currency",
			currency: currency || "USD",
		}).format(amount);
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
				<Select
					value={dateFilter}
					onValueChange={(v) => setDateFilter(v as DateFilter)}
				>
					<SelectTrigger className="w-40">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">{t("filter.all")}</SelectItem>
						<SelectItem value="last30">{t("filter.last30")}</SelectItem>
						<SelectItem value="last90">{t("filter.last90")}</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{query.isLoading ? (
				<p className="text-muted-foreground text-sm">{t("loading")}</p>
			) : query.isError ? (
				<p className="text-destructive text-sm">{t("failed")}</p>
			) : filteredInvoices.length === 0 ? (
				<Card>
					<CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
						<FileText className="size-8 text-muted-foreground" />
						<p className="font-medium text-sm">{t("empty")}</p>
						<p className="text-muted-foreground text-sm">
							{t("emptyDescription")}
						</p>
						<Button asChild>
							<Link href="/choose-plan">{t("emptyCta")}</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className="p-0">
						<div className="overflow-hidden rounded-lg border">
							<table className="w-full text-sm">
								<thead className="bg-muted/50">
									<tr className="text-left">
										<th className="p-3 font-medium">{t("col.date")}</th>
										<th className="p-3 font-medium">{t("col.amount")}</th>
										<th className="p-3 font-medium">{t("col.status")}</th>
										<th className="p-3 text-right font-medium">
											{t("col.actions")}
										</th>
									</tr>
								</thead>
								<tbody className="divide-y">
									{filteredInvoices.map((invoice) => (
										<tr key={invoice.id}>
											<td className="p-3 text-muted-foreground text-xs">
												{invoice.issuedAt.toLocaleDateString(locale)}
											</td>
											<td className="p-3 font-medium">
												{formatAmount(Number(invoice.amount), invoice.currency)}
											</td>
											<td className="p-3">
												<InvoiceStatusBadge status={invoice.status} />
											</td>
											<td className="p-3 text-right">
												{invoice.pdfUrl || invoice.url ? (
													<Button variant="ghost" size="sm" asChild>
														<a
															href={invoice.pdfUrl ?? invoice.url ?? "#"}
															target="_blank"
															rel="noopener noreferrer"
														>
															<Download className="size-4" />
															{t("download")}
														</a>
													</Button>
												) : (
													<span className="text-muted-foreground text-xs">
														{t("noPdf")}
													</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
