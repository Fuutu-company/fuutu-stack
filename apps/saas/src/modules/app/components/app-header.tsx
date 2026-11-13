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
import { type BreadcrumbSegment, buildBreadcrumbs } from "./breadcrumbs";
import { ThemeToggle } from "./theme-toggle";

function useBreadcrumbs(): BreadcrumbSegment[] {
	const pathname = usePathname();
	const tab = useSearchParams().get("tab");
	return buildBreadcrumbs(pathname, tab);
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
		<header className="hidden h-14 shrink-0 items-center gap-2 bg-transparent px-4 md:flex md:px-8">
			<SidebarTrigger className="-ml-1" />
			<Separator
				orientation="vertical"
				className="mr-2 data-[orientation=vertical]:h-4"
			/>
			<Breadcrumb label={t("breadcrumb.ariaLabel")}>
				<BreadcrumbList className="font-semibold text-sm">
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
