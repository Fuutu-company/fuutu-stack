import { getTranslations } from "next-intl/server";
import { AdminUsersTable } from "@/modules/app/admin/admin-users-table";

export default async function AdminUsersPage() {
	const t = await getTranslations("admin.users");
	return (
		<>
			<div>
				<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("description")}</p>
			</div>
			<AdminUsersTable />
		</>
	);
}
