import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import { AdminSystemStatus } from "@/modules/app/admin/system/admin-system-status";

export default async function AdminSystemPage() {
	const t = await getTranslations("admin.system");
	return (
		<>
			<PageHeader variant="compact" title={t("title")} />
			<AdminSystemStatus />
		</>
	);
}
