import { auth } from "@fuutu/auth";
import {
	countAuditLogsByOrg,
	findAuditLogsByOrg,
	getOrganizationBySlug,
} from "@fuutu/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/auth-server";
import type { AuditLogActionFilter } from "@/modules/app/audit-log/components/audit-log-filters";
import { OrgAuditLogList } from "@/modules/app/audit-log/components/org-audit-log-list";

const PAGE_SIZE = 20;

interface Props {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ filter?: string; page?: string }>;
}

export default async function OrgAuditLogPage({ params, searchParams }: Props) {
	const { slug } = await params;
	const { filter: filterParam, page: pageParam } = await searchParams;

	const t = await getTranslations("organizations");
	const tAdmin = await getTranslations("admin");
	const tCommon = await getTranslations("common");

	const session = await getSession();
	if (!session) {
		redirect("/auth/sign-in");
	}

	const org = await getOrganizationBySlug(slug);
	if (!org) {
		redirect("/organizations");
	}

	const fullOrg = await auth.api.getFullOrganization({
		query: { organizationId: org.id },
		headers: await headers(),
	});
	const isMember = fullOrg?.members?.some(
		(m: { userId: string }) => m.userId === session.user.id,
	);
	if (!isMember) {
		redirect("/organizations");
	}

	const filter: AuditLogActionFilter =
		filterParam === "member" ||
		filterParam === "billing" ||
		filterParam === "settings" ||
		filterParam === "auth"
			? filterParam
			: "all";

	const page = Math.max(1, Number(pageParam) || 1);
	const action = filter === "all" ? undefined : filter;

	const [items, total] = await Promise.all([
		findAuditLogsByOrg(org.id, {
			action,
			take: PAGE_SIZE,
			skip: (page - 1) * PAGE_SIZE,
		}),
		countAuditLogsByOrg(org.id, { action }),
	]);

	return (
		<div className="mx-auto max-w-4xl">
			<OrgAuditLogList
				slug={slug}
				logs={items}
				total={total}
				page={page}
				pageSize={PAGE_SIZE}
				filter={filter}
				labels={{
					title: t("settings.auditLog.title"),
					description: t("settings.auditLog.description"),
					empty: tAdmin("auditLogs.empty"),
					colTime: tAdmin("auditLogs.col.time"),
					colAction: tAdmin("auditLogs.col.action"),
					colUser: tAdmin("auditLogs.col.user"),
					colIp: tAdmin("auditLogs.col.ip"),
					pageLabel: tAdmin("auditLogs.page", { page, total }),
					prev: tAdmin("auditLogs.prev"),
					next: tAdmin("auditLogs.next"),
					notAvailable: tCommon("notAvailable"),
				}}
			/>
		</div>
	);
}
