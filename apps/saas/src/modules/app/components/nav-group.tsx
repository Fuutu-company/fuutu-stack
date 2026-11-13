"use client";

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
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@fuutu/ui";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { isNavItemActive, isPathWithin, type NavSubItem } from "./nav-config";

/** Expanded groups mark the active leaf with the ink pill; the trigger stays soft. */
const SOFT_ACTIVE =
	"data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground data-[active=true]:hover:bg-sidebar-accent data-[active=true]:hover:text-sidebar-accent-foreground";

interface NavGroupProps {
	/** Stable id used for the e2e hook (`data-nav-group`). */
	id: string;
	label: string;
	icon: LucideIcon;
	/** Path prefix that makes the whole group active. */
	activePrefix: string;
	items: NavSubItem[];
}

/**
 * The one collapsible sidebar group pattern: chevron trigger, sub-items with
 * active highlighting, opens whenever the route changes into the group, and a
 * dropdown fallback when the sidebar is collapsed to icons.
 */
export function NavGroup({
	id,
	label,
	icon: Icon,
	activePrefix,
	items,
}: NavGroupProps) {
	const t = useTranslations("navigation");
	const pathname = usePathname();
	const tab = useSearchParams().get("tab");
	const { isMobile, state: sidebarState } = useSidebar();
	const isIconMode = !isMobile && sidebarState === "collapsed";

	const groupActive = isPathWithin(pathname, activePrefix);
	const [open, setOpen] = useState(groupActive);

	// Client-side navigation into the group must open it; the user can still
	// toggle it manually while staying on the same route.
	useEffect(() => {
		if (groupActive) setOpen(true);
	}, [groupActive]);

	if (isIconMode) {
		return (
			<SidebarMenuItem data-nav-group={id}>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton tooltip={label} isActive={groupActive}>
							<Icon />
							<span>{label}</span>
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="right"
						sideOffset={4}
						align="start"
						className="min-w-56"
					>
						<DropdownMenuLabel className="text-muted-foreground text-xs">
							{label}
						</DropdownMenuLabel>
						<DropdownMenuSeparator />
						{items.map((item) => (
							<DropdownMenuItem key={item.href} asChild>
								<Link href={item.href}>{t(item.titleKey)}</Link>
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		);
	}

	return (
		<Collapsible
			asChild
			open={open}
			onOpenChange={setOpen}
			className="group/collapsible"
		>
			<SidebarMenuItem data-nav-group={id}>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton
						tooltip={label}
						isActive={groupActive}
						className={SOFT_ACTIVE}
					>
						<Icon />
						<span>{label}</span>
						<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
					</SidebarMenuButton>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{items.map((item) => {
							const active = isNavItemActive(item, pathname, tab);
							return (
								<SidebarMenuSubItem key={item.href}>
									<SidebarMenuSubButton asChild isActive={active}>
										<Link
											href={item.href}
											aria-current={active ? "page" : undefined}
										>
											<span>{t(item.titleKey)}</span>
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							);
						})}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}
