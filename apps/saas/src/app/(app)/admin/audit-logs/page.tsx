import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import { AuditLogsTable } from "@/modules/app/admin/audit-logs-table";

export default async function AuditLogsPage() {
	const t = await getTranslations("admin.auditLogs");
	return (
		<>
			<PageHeader variant="compact" title={t("title")} />
			<AuditLogsTable />
		</>
	);
}
