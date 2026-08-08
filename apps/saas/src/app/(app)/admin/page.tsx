import { Card, CardContent } from "@fuutu/ui";
import { FileText, Users } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function AdminDashboardPage() {
	const t = await getTranslations("admin.dashboard");
	const links = [
		{
			href: "/admin/users" as const,
			title: t("usersCard"),
			description: t("usersCardDescription"),
			icon: Users,
		},
		{
			href: "/admin/audit-logs" as const,
			title: t("auditLogsCard"),
			description: t("auditLogsCardDescription"),
			icon: FileText,
		},
	];
	return (
		<>
			<div>
				<h1 className="font-bold text-3xl tracking-tight">{t("title")}</h1>
				<p className="mt-2 text-muted-foreground">{t("description")}</p>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				{links.map((link) => (
					<Link key={link.href} href={link.href} className="group">
						<Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
							<CardContent className="p-6">
								<div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<link.icon className="size-5" />
								</div>
								<h3 className="font-semibold">{link.title}</h3>
								<p className="mt-1 text-muted-foreground text-sm">
									{link.description}
								</p>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>
		</>
	);
}
