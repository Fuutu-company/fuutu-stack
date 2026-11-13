"use client";

import { config } from "@fuutu/config";
import {
	hasOrgPermission,
	ORG_POLICY,
	OrgAccessControl,
	PERMISSIONS,
	toOrgRole,
} from "@fuutu/rbac";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@fuutu/ui";
import {
	Bell,
	LayoutDashboard,
	type LucideIcon,
	MessageSquare,
	Settings,
	UserCog,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOrgRole } from "../organizations/use-org-role";
import {
	ACCOUNT_SETTINGS_PATH,
	getAccountItems,
	getOrgSettingsItems,
	orgSettingsBase,
} from "./nav-config";
import { NavGroup } from "./nav-group";

const orgAC = new OrgAccessControl(ORG_POLICY);

interface NavItem {
	titleKey: string;
	url: string;
	icon: LucideIcon;
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
	const orgRole = useOrgRole(orgSlug);
	const inOrg = orgSlug !== null;

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

	const canViewAuditLog = orgRole
		? hasOrgPermission(orgAC, toOrgRole(orgRole), PERMISSIONS.AUDIT_LOG.VIEW)
		: false;
	const showOrgGroup = inOrg && config.features.organizationsMode !== "off";

	const isActive = (url: string): boolean => {
		return pathname === url || pathname.startsWith(`${url}/`);
	};

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

	return (
		<>
			<SidebarGroup>
				<SidebarGroupLabel>{t("navigation.groupPlatform")}</SidebarGroupLabel>
				<SidebarMenu>
					{platformItems.map((item) => renderItem(item))}
				</SidebarMenu>
			</SidebarGroup>

			{showOrgGroup && orgSlug && (
				<SidebarGroup>
					<SidebarGroupLabel>
						{t("navigation.groupOrganization")}
					</SidebarGroupLabel>
					<SidebarMenu>
						<NavGroup
							id="org-settings"
							label={t("navigation.organizationSettings")}
							icon={Settings}
							activePrefix={orgSettingsBase(orgSlug)}
							items={getOrgSettingsItems(orgSlug, canViewAuditLog)}
						/>
					</SidebarMenu>
				</SidebarGroup>
			)}

			<SidebarGroup>
				<SidebarGroupLabel>{t("navigation.groupAccount")}</SidebarGroupLabel>
				<SidebarMenu>
					<NavGroup
						id="account-settings"
						label={t("navigation.accountSettings")}
						icon={UserCog}
						activePrefix={ACCOUNT_SETTINGS_PATH}
						items={getAccountItems()}
					/>
				</SidebarMenu>
			</SidebarGroup>
		</>
	);
}
