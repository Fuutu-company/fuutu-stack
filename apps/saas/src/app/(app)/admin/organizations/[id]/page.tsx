import { PageHeader } from "@fuutu/ui";
import { getTranslations } from "next-intl/server";
import { AdminOrganizationDetail } from "@/modules/app/admin/org-detail/admin-organization-detail";

export default async function AdminOrganizationDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const [{ id }, t] = await Promise.all([
		params,
		getTranslations("admin.organizationDetail"),
	]);
	return (
		<>
			<PageHeader variant="compact" title={t("title")} />
			<AdminOrganizationDetail organizationId={id} />
		</>
	);
}
