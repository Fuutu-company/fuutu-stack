"use client";

import { Badge } from "@fuutu/ui";
import { useTranslations } from "next-intl";

export function InvoiceStatusBadge({ status }: { status: string }) {
	const t = useTranslations("invoices");

	const variant =
		status === "paid" ? "default" : status === "open" ? "secondary" : "outline";

	return <Badge variant={variant}>{t(`status.${status}`)}</Badge>;
}
