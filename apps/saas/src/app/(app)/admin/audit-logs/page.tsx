import { getTranslations } from "next-intl/server";
import { AuditLogsTable } from "@/modules/app/admin/audit-logs-table";

export default async function AuditLogsPage() {
	const t = await getTranslations("admin.auditLogs");
	return (
		<>
			<div>
				<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("description")}</p>
			</div>
			<AuditLogsTable />
		</>
	);
}
