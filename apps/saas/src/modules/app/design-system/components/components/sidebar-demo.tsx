"use client";

import {
	BrandLogo,
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
} from "@fuutu/ui";
import {
	Bell,
	Building2,
	KeyRound,
	LayoutDashboard,
	MoreHorizontal,
	Plus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { richCode } from "../design-section";
import { DesignSubsection } from "../design-subsection";

/**
 * A static copy of the app shell's sidebar. `collapsible="none"` keeps it
 * inline; its own provider keeps it apart from the real sidebar. The trigger
 * and rail are disabled so the demo never writes the `sidebar_state` cookie
 * the real sidebar reads.
 */
export function SidebarDemo() {
	const t = useTranslations("designSystem.components.sidebar");

	return (
		<DesignSubsection
			title={t("title")}
			description={t.rich("description", richCode)}
		>
			<SidebarProvider
				defaultOpen
				labels={{ toggle: t("toggle") }}
				className="h-[34rem] min-h-0 overflow-hidden rounded-xl border"
			>
				<Sidebar
					collapsible="none"
					className="w-full border-r md:w-(--sidebar-width)"
				>
					<SidebarHeader className="gap-3 p-3">
						<div className="flex items-center gap-2 px-1">
							<BrandLogo size="sm" className="dark:invert" />
							<span className="font-semibold text-sm">{t("brand")}</span>
						</div>
						<SidebarInput aria-label={t("search")} placeholder={t("search")} />
					</SidebarHeader>
					<SidebarSeparator />
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>{t("platform")}</SidebarGroupLabel>
							<SidebarGroupAction
								title={t("add")}
								aria-label={t("add")}
								disabled
							>
								<Plus />
							</SidebarGroupAction>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton isActive>
											<LayoutDashboard />
											<span>{t("dashboard")}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton>
											<Bell />
											<span>{t("notifications")}</span>
										</SidebarMenuButton>
										<SidebarMenuBadge>{t("unread")}</SidebarMenuBadge>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton>
											<Building2 />
											<span>{t("organizations")}</span>
										</SidebarMenuButton>
										<SidebarMenuAction aria-label={t("more")} disabled>
											<MoreHorizontal />
										</SidebarMenuAction>
										<SidebarMenuSub>
											<SidebarMenuSubItem>
												<SidebarMenuSubButton isActive>
													<span>{t("members")}</span>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
											<SidebarMenuSubItem>
												<SidebarMenuSubButton>
													<span>{t("billing")}</span>
												</SidebarMenuSubButton>
											</SidebarMenuSubItem>
										</SidebarMenuSub>
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuButton>
											<KeyRound />
											<span>{t("apiKeys")}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
						<SidebarGroup>
							<SidebarGroupLabel>{t("loading")}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuSkeleton showIcon />
									</SidebarMenuItem>
									<SidebarMenuItem>
										<SidebarMenuSkeleton showIcon />
									</SidebarMenuItem>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
					<SidebarSeparator />
					<SidebarFooter className="p-3 text-muted-foreground text-xs">
						{t("footer")}
					</SidebarFooter>
					<SidebarRail disabled />
				</Sidebar>
				<SidebarInset className="hidden min-w-0 p-4 md:flex">
					<div className="flex items-center gap-2">
						<SidebarTrigger disabled />
						<span className="font-medium text-sm">{t("content")}</span>
					</div>
				</SidebarInset>
			</SidebarProvider>
		</DesignSubsection>
	);
}
