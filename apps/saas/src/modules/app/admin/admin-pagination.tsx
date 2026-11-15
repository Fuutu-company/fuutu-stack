"use client";

import { Button } from "@fuutu/ui";
import { useTranslations } from "next-intl";

export function AdminPagination({
	page,
	totalPages,
	total,
	onPageChange,
}: {
	page: number;
	totalPages: number;
	total: number;
	onPageChange: (page: number) => void;
}) {
	const t = useTranslations("admin.pagination");
	return (
		<div className="flex flex-wrap items-center justify-between gap-2">
			<p className="text-muted-foreground text-xs">
				{t("summary", { page, totalPages, total })}
			</p>
			<div className="flex gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={page <= 1}
					onClick={() => onPageChange(page - 1)}
				>
					{t("prev")}
				</Button>
				<Button
					variant="outline"
					size="sm"
					disabled={page >= totalPages}
					onClick={() => onPageChange(page + 1)}
				>
					{t("next")}
				</Button>
			</div>
		</div>
	);
}
