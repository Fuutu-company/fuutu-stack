"use client";

import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
	Separator,
	SidebarTrigger,
} from "@fuutu/ui";
import { LocaleSwitcher } from "@shared/components/locale-switcher";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import * as React from "react";
import { NotificationBell } from "@/modules/app/notifications/components/notification-bell";
import { ThemeToggle } from "./theme-toggle";

interface BreadcrumbSegment {
	/** i18n key under navigation.breadcrumb.*, or null for dynamic labels */
	labelKey: string | null;
	/** Raw label for dynamic segments (e.g. org slug) */
	label?: string;
	href?: string;
}

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function useBreadcrumbs(): BreadcrumbSegment[] {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const segments = pathname.split("/").filter(Boolean);
	const crumbs: BreadcrumbSegment[] = [];

	const routeMap: Record<string, string> = {
		dashboard: "breadcrumb.dashboard",
		settings: "breadcrumb.settings",
		organizations: "breadcrumb.organizations",
		admin: "breadcrumb.admin",
		chat: "breadcrumb.chat",
		crm: "breadcrumb.crm",
		onboarding: "breadcrumb.onboarding",
		"choose-plan": "breadcrumb.choosePlan",
		notifications: "breadcrumb.notifications",
	};

	const adminSubRoutes: Record<string, string> = {
		users: "breadcrumb.users",
		"audit-logs": "breadcrumb.auditLogs",
	};

	const settingsTabMap: Record<string, string> = {
		profile: "breadcrumb.profile",
		security: "breadcrumb.security",
		sessions: "breadcrumb.sessions",
	};

	const settingsSubRoutes: Record<string, string> = {
		"api-keys": "breadcrumb.apiKeys",
		billing: "breadcrumb.billing",
	};

	const orgSettingsSubRoutes: Record<string, string> = {
		general: "breadcrumb.general",
		members: "breadcrumb.members",
		billing: "breadcrumb.billing",
		danger: "breadcrumb.danger",
		"api-keys": "breadcrumb.apiKeys",
		webhooks: "breadcrumb.webhooks",
		"audit-log": "breadcrumb.auditLog",
	};

	// Check if we're in an org route: /organizations/[slug]/...
	const orgSlugIndex = segments.indexOf("organizations");
	const inOrgRoute = orgSlugIndex !== -1 && orgSlugIndex + 1 < segments.length;

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];
		const key = routeMap[segment];

		if (key) {
			const href = `/${segments.slice(0, i + 1).join("/")}`;
			crumbs.push({ labelKey: key, href });
		} else if (segments[0] === "admin" && adminSubRoutes[segment]) {
			crumbs.push({
				labelKey: adminSubRoutes[segment],
				href: `/${segments.slice(0, i + 1).join("/")}`,
			});
		} else if (inOrgRoute && i === orgSlugIndex + 1) {
			// Dynamic org slug
			crumbs.push({
				labelKey: null,
				label: capitalize(segment),
				href: `/organizations/${segment}/dashboard`,
			});
		} else if (inOrgRoute && orgSettingsSubRoutes[segment]) {
			crumbs.push({
				labelKey: orgSettingsSubRoutes[segment],
				href: `/${segments.slice(0, i + 1).join("/")}`,
			});
		} else if (inOrgRoute && segment === "invoices") {
			crumbs.push({
				labelKey: "breadcrumb.invoices",
				href: `/${segments.slice(0, i + 1).join("/")}`,
			});
		} else if (
			!inOrgRoute &&
			segments.includes("settings") &&
			settingsSubRoutes[segment]
		) {
			crumbs.push({
				labelKey: settingsSubRoutes[segment],
				href: `/${segments.slice(0, i + 1).join("/")}`,
			});
		}
	}

	// Add tab suffix for personal settings (still tab-based)
	const tab = searchParams.get("tab");
	if (tab) {
		if (segments.includes("settings") && settingsTabMap[tab]) {
			crumbs.push({ labelKey: settingsTabMap[tab] });
		}
	}

	return crumbs;
}

function BreadcrumbLabel({
	crumbs,
	t,
}: {
	crumbs: BreadcrumbSegment;
	t: (key: string) => string;
}) {
	return <>{crumbs.labelKey ? t(crumbs.labelKey) : crumbs.label}</>;
}

export function AppHeader() {
	const t = useTranslations("navigation");
	const crumbs = useBreadcrumbs();

	return (
		<header className="hidden h-10 shrink-0 items-center gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-9 md:flex">
			<SidebarTrigger className="-ml-1" />
			<Separator
				orientation="vertical"
				className="mr-2 data-[orientation=vertical]:h-4"
			/>
			<Breadcrumb>
				<BreadcrumbList>
					{crumbs.map((crumb, index) => {
						const isLast = index === crumbs.length - 1;
						return (
							<React.Fragment key={`crumb-${index}`}>
								{index > 0 && (
									<BreadcrumbSeparator className="hidden md:block" />
								)}
								<BreadcrumbItem
									className={index > 0 ? "hidden md:flex" : undefined}
								>
									{isLast || !crumb.href ? (
										<BreadcrumbPage>
											<BreadcrumbLabel crumbs={crumb} t={t} />
										</BreadcrumbPage>
									) : (
										<BreadcrumbLink asChild>
											<Link href={crumb.href}>
												<BreadcrumbLabel crumbs={crumb} t={t} />
											</Link>
										</BreadcrumbLink>
									)}
								</BreadcrumbItem>
							</React.Fragment>
						);
					})}
				</BreadcrumbList>
			</Breadcrumb>
			<div className="ml-auto flex items-center gap-1">
				<NotificationBell />
				<LocaleSwitcher />
				<ThemeToggle />
			</div>
		</header>
	);
}
