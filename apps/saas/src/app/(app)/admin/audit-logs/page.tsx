import { env } from "@fuutu/env/saas";
import { Alert, AlertDescription, AlertTitle, PageHeader } from "@fuutu/ui";
import { TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AuditLogsTable } from "@/modules/app/admin/audit-logs-table";

export default async function AuditLogsPage() {
	const t = await getTranslations("admin.auditLogs");
	return (
		<>
			<PageHeader variant="compact" title={t("title")} />
			{env.LOG_AUDIT_SINK !== "db" ? (
				<Alert data-testid="audit-sink-notice">
					<TriangleAlert />
					<AlertTitle>{t("sinkNotice.title")}</AlertTitle>
					<AlertDescription>{t("sinkNotice.description")}</AlertDescription>
				</Alert>
			) : null}
			<Suspense>
				<AuditLogsTable />
			</Suspense>
		</>
	);
}
