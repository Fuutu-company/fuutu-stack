import { QuickActions, RecentActivity, StatsOverview } from "@app/dashboard";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function OrgDashboardPage() {
	const t = await getTranslations("dashboard");

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-bold text-3xl">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("welcome")}</p>
				<Link
					href="/dashboard"
					className="mt-1 inline-flex items-center gap-1 text-primary text-xs hover:underline"
				>
					<ArrowLeft className="size-3" />
					{t("backToPersonal")}
				</Link>
			</div>
			<StatsOverview />
			<div className="grid gap-6 lg:grid-cols-2">
				<RecentActivity />
				<QuickActions />
			</div>
		</div>
	);
}
