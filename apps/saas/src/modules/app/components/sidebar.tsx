"use client";

import { authClient } from "@fuutu/auth/client";
import { type UserWithRole, userHasPermission } from "@fuutu/auth/types";
import { config } from "@fuutu/config";
import { AccessControl, DEFAULT_ACCESS_POLICY, PERMISSIONS } from "@fuutu/rbac";
import {
	BrandLogo,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	useSidebar,
} from "@fuutu/ui";
import { LocaleSwitcher } from "@shared/components/locale-switcher";
import { Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { OrgSwitcher } from "./org-switcher";
import { ThemeToggle } from "./theme-toggle";

const ac = new AccessControl(DEFAULT_ACCESS_POLICY);

export function AppSidebar() {
	const pathname = usePathname();
	const t = useTranslations();
	const { data: session } = authClient.useSession();
	const user = session?.user as UserWithRole | undefined;
	const userIsAdmin = user
		? userHasPermission(ac, user, PERMISSIONS.VIEW_ADMIN)
		: false;
	const { isMobile, setOpenMobile } = useSidebar();

	// Auto-close mobile sidebar on route change
	useEffect(() => {
		if (isMobile) {
			setOpenMobile(false);
		}
	}, [pathname, isMobile, setOpenMobile]);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				{/* Static app logo + name — name hidden when sidebar collapsed to icon */}
				<Link href="/dashboard" className="flex items-center gap-2.5 px-2 py-2">
					<BrandLogo
						size="md"
						alt={t("app.brand")}
						className="size-7 dark:invert"
					/>
					<span className="font-semibold text-foreground text-sm tracking-tight group-data-[collapsible=icon]:hidden">
						{t("app.brand")}
					</span>
				</Link>

				{/* Org switcher — below app logo, only in org mode */}
				{config.features.organizationsMode !== "off" && <OrgSwitcher />}
			</SidebarHeader>
			<SidebarContent>
				<NavMain />
				{userIsAdmin && (
					<SidebarGroup>
						<SidebarGroupLabel>
							{t("navigation.groupAdministration")}
						</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										asChild
										isActive={pathname.startsWith("/admin")}
									>
										<Link href="/admin">
											<Shield />
											<span>{t("navigation.admin")}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				)}
			</SidebarContent>
			<SidebarFooter>
				{/* Locale + theme — mobile only, above user profile */}
				<div className="flex items-center justify-between gap-1 px-2 py-1 md:hidden">
					<LocaleSwitcher />
					<ThemeToggle />
				</div>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
