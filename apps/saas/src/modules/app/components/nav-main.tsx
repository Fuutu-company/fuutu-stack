"use client";

import { config } from "@fuutu/config";
import { paymentsConfig } from "@fuutu/payments/config";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@fuutu/ui";
import {
	Bell,
	ChevronRight,
	LayoutDashboard,
	type LucideIcon,
	MessageSquare,
	Settings,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

interface NavItem {
	titleKey: string;
	url: string;
	icon: LucideIcon;
}

interface SubItem {
	titleKey: string;
	url: string;
}

/** Extract org slug from pathname if inside an org route */
function useOrgSlug(): string | null {
	const pathname = usePathname();
	const match = pathname.match(/^\/organizations\/([^/]+)/);
	return match?.[1] ?? null;
}

export function NavMain() {
	const pathname = usePathname();
	const t = useTranslations();
	const orgSlug = useOrgSlug();
	const inOrg = orgSlug !== null;
	const { isMobile, state: sidebarState } = useSidebar();
	const isCollapsed = !isMobile && sidebarState === "collapsed";

	// Build base URLs — org-scoped when inside an org, personal otherwise
	const base = inOrg ? `/organizations/${orgSlug}` : "";

	const platformItems: NavItem[] = [
		{
			titleKey: "dashboard",
			url: `${base}/dashboard`,
			icon: LayoutDashboard,
		},
	];

	if (config.features.aiChat) {
		platformItems.push({
			titleKey: "aiChat",
			url: `${base}/chat`,
			icon: MessageSquare,
		});
	}

	if (config.features.crm) {
		platformItems.push({
			titleKey: "crm",
			url: `${base}/crm`,
			icon: Users,
		});
	}

	platformItems.push({
		titleKey: "notifications",
		url: "/notifications",
		icon: Bell,
	});

	// Organization settings sub-items — only when inside an org
	const settingsBase = `/organizations/${orgSlug}/settings`;
	const settingsSubItems: SubItem[] = [
		{ titleKey: "general", url: `${settingsBase}/general` },
		{ titleKey: "members", url: `${settingsBase}/members` },
	];
	if (paymentsConfig.billingAttachedTo === "organization") {
		settingsSubItems.push({
			titleKey: "billing",
			url: `${settingsBase}/billing`,
		});
	}
	settingsSubItems.push(
		{ titleKey: "apiKeys", url: `${settingsBase}/api-keys` },
		{ titleKey: "webhooks", url: `${settingsBase}/webhooks` },
		{ titleKey: "auditLog", url: `${settingsBase}/audit-log` },
	);
	settingsSubItems.push({ titleKey: "danger", url: `${settingsBase}/danger` });

	const showOrgGroup = inOrg && config.features.organizationsMode !== "off";

	const isActive = (url: string): boolean => {
		return pathname === url || pathname.startsWith(`${url}/`);
	};

	const isSettingsActive = showOrgGroup && pathname.startsWith(settingsBase);

	const renderItem = (item: NavItem) => (
		<SidebarMenuItem key={item.titleKey}>
			<SidebarMenuButton
				tooltip={t(`navigation.${item.titleKey}`)}
				isActive={isActive(item.url)}
				asChild
			>
				<Link href={item.url}>
					<item.icon />
					<span>{t(`navigation.${item.titleKey}`)}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);

	const settingsLabel = t("navigation.organizationSettings");

	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel>{t("navigation.groupPlatform")}</SidebarGroupLabel>
				<SidebarMenu>
					{platformItems.map((item) => renderItem(item))}
				</SidebarMenu>
			</SidebarGroup>

			{showOrgGroup && (
				<SidebarGroup>
					<SidebarGroupLabel>
						{t("navigation.groupOrganization")}
					</SidebarGroupLabel>
					<SidebarMenu>
						{isCollapsed ? (
							<SidebarMenuItem>
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<SidebarMenuButton
											tooltip={settingsLabel}
											isActive={isSettingsActive}
										>
											<Settings />
											<span>{settingsLabel}</span>
										</SidebarMenuButton>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										side="right"
										sideOffset={4}
										align="start"
										className="min-w-56"
									>
										<DropdownMenuLabel className="text-muted-foreground text-xs">
											{settingsLabel}
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{settingsSubItems.map((subItem) => (
											<DropdownMenuItem key={subItem.titleKey} asChild>
												<Link href={subItem.url}>
													{t(`navigation.${subItem.titleKey}`)}
												</Link>
											</DropdownMenuItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							</SidebarMenuItem>
						) : (
							<Collapsible
								asChild
								defaultOpen={isSettingsActive}
								className="group/collapsible"
							>
								<SidebarMenuItem>
									<CollapsibleTrigger asChild>
										<SidebarMenuButton
											tooltip={settingsLabel}
											isActive={isSettingsActive}
										>
											<Settings />
											<span>{settingsLabel}</span>
											<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub>
											{settingsSubItems.map((subItem) => (
												<SidebarMenuSubItem key={subItem.titleKey}>
													<SidebarMenuSubButton
														asChild
														isActive={pathname === subItem.url}
													>
														<Link href={subItem.url}>
															<span>{t(`navigation.${subItem.titleKey}`)}</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											))}
										</SidebarMenuSub>
									</CollapsibleContent>
								</SidebarMenuItem>
							</Collapsible>
						)}
					</SidebarMenu>
				</SidebarGroup>
			)}
		</>
	);
}
