import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth-server";
import { AdminUserDetail } from "@/modules/app/admin/user-detail/admin-user-detail";

export default async function AdminUserDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const [{ id }, session, t] = await Promise.all([
		params,
		getSession(),
		getTranslations("admin.userDetail"),
	]);
	return (
		<>
			<PageHeader variant="compact" title={t("title")} />
			<AdminUserDetail userId={id} currentUserId={session?.user.id ?? ""} />
		</>
	);
}
