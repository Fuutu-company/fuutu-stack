"use client";

import { config } from "@fuutu/config";
import {
	hasOrgPermission,
	type KnownPermission,
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
import { Settings, UserCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useOrgRole } from "../organizations/use-org-role";
import {
	ACCOUNT_SETTINGS_PATH,
	getAccountItems,
	getMainItems,
	getOrgSettingsItems,
	type MainNavItem,
	orgSettingsBase,
} from "./nav-config";
import { NavGroup } from "./nav-group";

const orgAC = new OrgAccessControl(ORG_POLICY);

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

	const can = (permission: KnownPermission): boolean =>
		orgRole ? hasOrgPermission(orgAC, toOrgRole(orgRole), permission) : false;
	const canViewAuditLog = can(PERMISSIONS.AUDIT_LOG.VIEW);
	// Kit items (org-scoped inside an org) + app items (app-main-nav.ts).
	const platformItems = getMainItems(orgSlug, can);
	const showOrgGroup = inOrg && config.features.organizationsMode !== "off";

	const isActive = (item: MainNavItem): boolean =>
		item.exact
			? pathname === item.url
			: pathname === item.url || pathname.startsWith(`${item.url}/`);

	const renderItem = (item: MainNavItem) => (
		<SidebarMenuItem key={item.titleKey}>
			<SidebarMenuButton
				tooltip={t(`navigation.${item.titleKey}`)}
				isActive={isActive(item)}
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
							items={getOrgSettingsItems(orgSlug, canViewAuditLog, can)}
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
