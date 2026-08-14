"use client";

import { paymentsConfig } from "@fuutu/payments/config";
import { cn } from "@fuutu/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface NavItem {
	key: string;
	href: string;
}

export function OrgSettingsNav({ slug }: { slug: string }) {
	const t = useTranslations("organizations");
	const pathname = usePathname();
	const base = `/organizations/${slug}/settings`;

	const items: NavItem[] = [
		{ key: "general", href: `${base}/general` },
		{ key: "members", href: `${base}/members` },
	];
	if (paymentsConfig.billingAttachedTo === "organization") {
		items.push({ key: "billing", href: `${base}/billing` });
	}
	if (paymentsConfig.creditsEnabled) {
		items.push({ key: "credits", href: `${base}/credits` });
	}
	items.push(
		{ key: "apiKeys", href: `${base}/api-keys` },
		{ key: "webhooks", href: `${base}/webhooks` },
		{ key: "auditLog", href: `${base}/audit-log` },
		{ key: "danger", href: `${base}/danger` },
	);

	const labelMap: Record<string, string> = {
		general: t("settings.general"),
		members: t("settings.members"),
		billing: t("settings.billing"),
		credits: t("settings.credits"),
		apiKeys: t("settings.apiKeys.title"),
		webhooks: t("settings.webhooks.title"),
		auditLog: t("settings.auditLog.title"),
		danger: t("settings.danger"),
	};

	return (
		<nav className="flex flex-wrap gap-1 border-b">
			{items.map((item) => {
				const active =
					pathname === item.href || pathname.startsWith(`${item.href}/`);
				return (
					<Link
						key={item.key}
						href={item.href}
						className={cn(
							"rounded-none border-b-2 px-3 py-2 font-medium text-sm transition-colors",
							active
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground",
						)}
					>
						{labelMap[item.key]}
					</Link>
				);
			})}
		</nav>
	);
}
