"use client";

import { BILLING_CURRENCY } from "@fuutu/payments/config";
import {
	AreaIcon,
	Button,
	Card,
	CardContent,
	PageHeader,
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
import { useMemo, useState } from "react";
import { useFullOrganization } from "@/modules/app/organizations/use-full-organization";
import { orpc } from "@/utils/orpc";
import { InvoiceStatusBadge } from "./invoice-status-badge";

type FullOrg = {
	id: string;
	name: string;
	slug: string;
};

type DateFilter = "all" | "last30" | "last90";

export function InvoiceList({ slug }: { slug?: string }) {
	const t = useTranslations("invoices");
	const locale = useLocale();
	// Better Auth's getFullOrganization() returns a superset of FullOrg — narrowing is safe.
	const org = (useFullOrganization(slug).data ?? null) as FullOrg | null;
	const [dateFilter, setDateFilter] = useState<DateFilter>("all");

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
			currency: currency || BILLING_CURRENCY,
		}).format(amount);
	}

	return (
		<div className="space-y-6">
			<PageHeader
				variant="compact"
				title={t("title")}
				actions={
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
				}
			/>

			{query.isLoading ? (
				<p className="text-muted-foreground text-sm">{t("loading")}</p>
			) : query.isError ? (
				<p className="text-destructive text-sm">{t("failed")}</p>
			) : filteredInvoices.length === 0 ? (
				<Card className="py-0">
					<CardContent className="flex flex-col items-center justify-center gap-3 p-12 text-center">
						<AreaIcon area="billing">
							<FileText />
						</AreaIcon>
						<p className="font-bold font-heading">{t("empty")}</p>
						<p className="text-muted-foreground text-sm">
							{t("emptyDescription")}
						</p>
						<Button asChild>
							<Link href="/choose-plan">{t("emptyCta")}</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card className="overflow-hidden py-0">
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead className="bg-muted/50">
								<tr className="text-left">
									<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
										{t("col.date")}
									</th>
									<th className="whitespace-nowrap px-4 py-3 font-semibold text-muted-foreground text-xs">
										{t("col.amount")}
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
								{filteredInvoices.map((invoice) => (
									<tr key={invoice.id}>
										<td
											className="p-3 text-muted-foreground text-xs"
											data-volatile
										>
											{invoice.issuedAt.toLocaleDateString(locale)}
										</td>
										<td className="px-4 py-3 font-medium">
											{formatAmount(Number(invoice.amount), invoice.currency)}
										</td>
										<td className="px-4 py-3">
											<InvoiceStatusBadge status={invoice.status} />
										</td>
										<td className="px-4 py-3 text-right">
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
				</Card>
			)}
		</div>
	);
}
