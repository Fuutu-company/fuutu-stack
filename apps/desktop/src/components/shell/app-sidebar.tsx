"use client";

import { config } from "@fuutu/config";
import {
	BrandLogo,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@fuutu/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ComponentType } from "react";
import { isNavActive, type NavItem } from "@/lib/nav";
import { NavAccount } from "./nav-account";

export type AppSidebarProps = {
	nav: NavItem[];
	top?: ComponentType;
	bottom?: ComponentType;
};

/** The SaaS app's sidebar: floating, collapses to icons. */
export function AppSidebar({ nav, top: Top, bottom: Bottom }: AppSidebarProps) {
	const t = useTranslations("desktop.shell.nav");
	const pathname = usePathname();
	return (
		<Sidebar collapsible="icon" variant="floating">
			<SidebarHeader>
				<Link href="/" className="flex items-center gap-2.5 px-2 py-2">
					<BrandLogo
						size="md"
						alt={config.app.name}
						className="size-7 dark:invert"
					/>
					<span className="font-semibold text-foreground text-sm tracking-tight group-data-[collapsible=icon]:hidden">
						{config.app.name}
					</span>
				</Link>
				{Top ? <Top /> : null}
			</SidebarHeader>
			<SidebarContent>
				<nav aria-label={t("primary")}>
					<SidebarGroup>
						<SidebarMenu>
							{nav.map((item) => {
								const { href, titleKey, icon: Icon } = item;
								const title = t(titleKey as "home");
								return (
									<SidebarMenuItem key={href}>
										<SidebarMenuButton
											asChild
											isActive={isNavActive(pathname, item)}
											tooltip={title}
										>
											<Link href={href}>
												<Icon />
												<span>{title}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroup>
				</nav>
			</SidebarContent>
			<SidebarFooter>
				{Bottom ? <Bottom /> : null}
				<NavAccount />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
