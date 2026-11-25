"use client";

import { Button } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import {
	SidebarCollapseTrigger,
	SidebarTrigger,
} from "fumadocs-ui/components/sidebar/base";
import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import { Menu, PanelLeft } from "lucide-react";
import type { ComponentProps } from "react";
import { DocsActions } from "./docs-actions";

/**
 * `slots.header`: the SaaS app's header — sidebar toggle on the left (plus
 * search while the sidebar is collapsed), the docs actions on the right —
 * and its mobile bar (brand, search and the button that opens the sidebar
 * sheet). The fumadocs triggers keep their translated labels and ARIA.
 */
export function DocsHeader({ className, ...props }: ComponentProps<"header">) {
	const { slots } = useDocsLayout();
	const { collapsed } = slots.sidebar.useSidebar();
	const { navTitle: NavTitle, searchTrigger } = slots;

	return (
		<>
			<header
				{...props}
				className={cn(
					"sticky top-(--fd-docs-row-1) z-30 hidden h-14 w-0 min-w-full bg-background/80 backdrop-blur-sm [grid-area:header] md:block",
					className,
				)}
			>
				<div className="flex h-full items-center gap-1 px-8">
					<Button asChild variant="ghost" size="icon" className="-ml-1">
						<SidebarCollapseTrigger>
							<PanelLeft className="size-4" />
						</SidebarCollapseTrigger>
					</Button>
					{collapsed && searchTrigger ? (
						<searchTrigger.sm hideIfDisabled className="size-10 rounded-full" />
					) : null}
					<DocsActions className="ml-auto" />
				</div>
			</header>
			<header className="sticky top-(--fd-docs-row-1) z-50 h-14 w-0 min-w-full bg-background [grid-area:header] md:hidden">
				<div className="flex h-full items-center gap-1 px-4">
					{NavTitle ? (
						<NavTitle className="me-auto flex items-center gap-2.5" />
					) : (
						<span className="me-auto" />
					)}
					{searchTrigger ? (
						<searchTrigger.sm hideIfDisabled className="size-10 rounded-full" />
					) : null}
					<Button asChild variant="ghost" size="icon">
						<SidebarTrigger>
							<Menu className="size-5" />
						</SidebarTrigger>
					</Button>
				</div>
			</header>
		</>
	);
}
