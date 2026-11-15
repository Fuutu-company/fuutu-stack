import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AdminUsersTable } from "@/modules/app/admin/admin-users-table";

export default async function AdminUsersPage() {
	const t = await getTranslations("admin.users");
	return (
		<>
			<PageHeader variant="compact" title={t("title")} />
			<Suspense>
				<AdminUsersTable />
			</Suspense>
		</>
	);
}
