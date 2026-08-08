"use client";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";

export type AuditLogActionFilter =
	| "all"
	| "member"
	| "billing"
	| "settings"
	| "auth";

export function AuditLogFilters({
	value,
	onChange,
}: {
	value: AuditLogActionFilter;
	onChange: (value: AuditLogActionFilter) => void;
}) {
	const t = useTranslations("organizations");

	return (
		<Select
			value={value}
			onValueChange={(v) => onChange(v as AuditLogActionFilter)}
		>
			<SelectTrigger className="w-48">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value="all">{t("settings.auditLog.filterAll")}</SelectItem>
				<SelectItem value="member">
					{t("settings.auditLog.filterMember")}
				</SelectItem>
				<SelectItem value="billing">
					{t("settings.auditLog.filterBilling")}
				</SelectItem>
				<SelectItem value="settings">
					{t("settings.auditLog.filterSettings")}
				</SelectItem>
				<SelectItem value="auth">
					{t("settings.auditLog.filterAuth")}
				</SelectItem>
			</SelectContent>
		</Select>
	);
}
