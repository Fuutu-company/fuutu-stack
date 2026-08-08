"use client";

import { config } from "@fuutu/config";
import { Button } from "@fuutu/ui";
import { CreditCard, Plus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function QuickActions() {
	const t = useTranslations("dashboard");

	const actions = [
		...(config.features.organizationsMode !== "off"
			? [
					{
						label: t("quickActions.inviteMember"),
						href: "/organizations",
						icon: UserPlus,
						variant: "default" as const,
					},
				]
			: [
					{
						label: t("quickActions.createOrg"),
						href: "/organizations",
						icon: Plus,
						variant: "default" as const,
					},
				]),
		{
			label: t("quickActions.configureBilling"),
			href: "/choose-plan",
			icon: CreditCard,
			variant: "outline" as const,
		},
	];

	return (
		<div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
			<h3 className="mb-4 font-semibold text-lg">{t("quickActions.title")}</h3>
			<div className="grid gap-3 sm:grid-cols-2">
				{actions.map((action) => {
					const Icon = action.icon;
					return (
						<Button
							key={action.label}
							variant={action.variant}
							className="h-auto justify-start p-4"
							asChild
						>
							<Link href={action.href}>
								<Icon className="mr-3 h-5 w-5" />
								{action.label}
							</Link>
						</Button>
					);
				})}
			</div>
		</div>
	);
}
