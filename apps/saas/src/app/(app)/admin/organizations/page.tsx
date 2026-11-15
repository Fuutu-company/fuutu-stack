import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminOrganizationsTable } from "@/modules/app/admin/admin-organizations-table";

export default async function AdminOrganizationsPage() {
	const t = await getTranslations("admin.organizations");
	return (
		<>
			<PageHeader variant="compact" title={t("title")} />
			<Suspense>
				<AdminOrganizationsTable />
			</Suspense>
		</>
	);
}
