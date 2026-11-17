"use client";

import { cn } from "@fuutu/utils/cn";
import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import {
	type ComponentProps,
	type CSSProperties,
	useEffect,
	useState,
} from "react";

/**
 * `slots.container`: the fumadocs grid, but the header row spans the main
 * and TOC columns (as the SaaS app's header spans the content), so its
 * actions sit at the right edge of the page. The header is always shown, so
 * its height is reserved at every breakpoint.
 */
export function DocsContainer(props: ComponentProps<"div">) {
	const { slots } = useDocsLayout();
	const { collapsed } = slots.sidebar.useSidebar();
	const [previousCollapsed, setPreviousCollapsed] = useState(collapsed);
	const isCollapseChanged = previousCollapsed !== collapsed;
	useEffect(() => {
		if (isCollapseChanged) setPreviousCollapsed(collapsed);
	}, [collapsed, isCollapseChanged]);

	return (
		<div
			id="nd-docs-layout"
			data-sidebar-collapsed={collapsed}
			data-column-changed={isCollapseChanged}
			{...props}
			style={
				{
					gridTemplate: `"sidebar sidebar header header header"
"sidebar sidebar toc-popover toc toc"
"sidebar sidebar main toc toc" 1fr / minmax(min-content, 1fr) var(--fd-sidebar-col) minmax(0, calc(var(--fd-layout-width,97rem) - var(--fd-sidebar-width) - var(--fd-toc-width))) var(--fd-toc-width) minmax(min-content, 1fr)`,
					"--fd-docs-row-1": "var(--fd-banner-height, 0px)",
					"--fd-docs-row-2":
						"calc(var(--fd-docs-row-1) + var(--fd-header-height))",
					"--fd-docs-row-3":
						"calc(var(--fd-docs-row-2) + var(--fd-toc-popover-height))",
					"--fd-sidebar-col": collapsed ? "0px" : "var(--fd-sidebar-width)",
					...props.style,
				} as CSSProperties
			}
			className={cn(
				"grid min-h-(--fd-docs-height) overflow-x-clip [--fd-docs-height:100dvh] [--fd-header-height:3.5rem] [--fd-sidebar-width:0px] [--fd-toc-popover-height:0px] [--fd-toc-width:0px] data-[column-changed=true]:transition-[grid-template-columns]",
				props.className,
			)}
		>
			{props.children}
		</div>
	);
}
