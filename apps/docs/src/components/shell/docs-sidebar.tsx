"use client";

import {
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenuButton,
	SidebarMenuSubButton,
	SidebarProvider,
} from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import type * as PageTree from "fumadocs-core/page-tree";
import {
	SidebarContent as FumadocsSidebarContent,
	SidebarDrawerContent,
	SidebarDrawerOverlay,
	SidebarFolder,
	SidebarFolderContent,
	SidebarFolderLink,
	SidebarFolderTrigger,
	SidebarItem,
	SidebarSeparator,
	useFolderDepth,
	useSidebar,
} from "fumadocs-ui/components/sidebar/base";
import { createPageTreeRenderer } from "fumadocs-ui/components/sidebar/page-tree";
import { useTreePath } from "fumadocs-ui/contexts/tree";
import { type DocsSlots, useDocsLayout } from "fumadocs-ui/layouts/docs";
import type { ComponentProps, ReactNode } from "react";
import { DocsActions } from "./docs-actions";

type SidebarProps = ComponentProps<DocsSlots["sidebar"]["root"]>;

/** A folder's own row stays soft; only the active page is the ink pill (as in the app). */
const SOFT_ACTIVE =
	"data-[active=true]:bg-sidebar-accent data-[active=true]:font-normal data-[active=true]:text-sidebar-accent-foreground data-[active=true]:hover:bg-sidebar-accent data-[active=true]:hover:text-sidebar-accent-foreground";

/** Same box as the app's `SidebarMenuSub`: an indented list with a hairline on the left. */
const SUB_LIST =
	"mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-sidebar-border border-l px-2.5 py-0.5";

function NavButton({
	depth,
	active,
	soft,
	children,
}: {
	depth: number;
	active: boolean;
	soft?: boolean;
	children: ReactNode;
}) {
	if (depth > 0) {
		return (
			<SidebarMenuSubButton asChild isActive={active}>
				{children}
			</SidebarMenuSubButton>
		);
	}
	return (
		<SidebarMenuButton
			asChild
			isActive={active}
			className={soft ? SOFT_ACTIVE : undefined}
		>
			{children}
		</SidebarMenuButton>
	);
}

function TreeItem({ item }: { item: PageTree.Item }) {
	const depth = useFolderDepth();
	const active = useTreePath().includes(item);
	return (
		<NavButton depth={depth} active={active}>
			<SidebarItem
				href={item.url}
				external={item.external}
				active={active}
				icon={item.icon}
			>
				<span>{item.name}</span>
			</SidebarItem>
		</NavButton>
	);
}

function TreeFolder({
	item,
	children,
}: {
	item: PageTree.Folder;
	children: ReactNode;
}) {
	const depth = useFolderDepth();
	const path = useTreePath();
	const active = path.includes(item);
	const indexActive = item.index ? path.includes(item.index) : false;
	return (
		<SidebarFolder
			collapsible={item.collapsible}
			active={active}
			defaultOpen={item.defaultOpen}
		>
			{item.index ? (
				<NavButton depth={depth} active={indexActive}>
					<SidebarFolderLink
						href={item.index.url}
						active={indexActive}
						external={item.index.external}
					>
						{item.icon}
						<span>{item.name}</span>
					</SidebarFolderLink>
				</NavButton>
			) : (
				<NavButton depth={depth} active={active} soft>
					<SidebarFolderTrigger>
						{item.icon}
						<span>{item.name}</span>
					</SidebarFolderTrigger>
				</NavButton>
			)}
			<SidebarFolderContent>
				<div className={SUB_LIST}>{children}</div>
			</SidebarFolderContent>
		</SidebarFolder>
	);
}

function TreeSeparator({ item }: { item: PageTree.Separator }) {
	return (
		<SidebarGroupLabel className="mt-2 first:mt-0">
			{item.icon}
			{item.name}
		</SidebarGroupLabel>
	);
}

const TreeRenderer = createPageTreeRenderer({
	SidebarFolder,
	SidebarFolderContent,
	SidebarFolderLink,
	SidebarFolderTrigger,
	SidebarItem,
	SidebarSeparator,
});

/** Brand, search, banner, the page tree and the footer, in the app's sidebar parts. */
function SidebarBody({
	mobile,
	banner,
	footer,
	components,
}: Pick<SidebarProps, "banner" | "footer" | "components"> & {
	mobile: boolean;
}) {
	const { slots } = useDocsLayout();
	const { navTitle: NavTitle, languageSelect, searchTrigger } = slots;
	return (
		<>
			<SidebarHeader>
				{NavTitle ? (
					<NavTitle className="flex items-center gap-2.5 px-2 py-2" />
				) : null}
				{searchTrigger ? (
					<searchTrigger.full
						hideIfDisabled
						className="h-10 rounded-full bg-transparent ps-3"
					/>
				) : null}
				{banner}
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<div className="flex flex-col gap-1">
						<TreeRenderer
							Item={TreeItem}
							Folder={TreeFolder}
							Separator={TreeSeparator}
							{...components}
						/>
					</div>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				{mobile ? <DocsActions className="justify-end" /> : null}
				{languageSelect ? (
					<languageSelect.root
						variant="secondary"
						className="w-full justify-start rounded-full"
					>
						<languageSelect.text />
					</languageSelect.root>
				) : null}
				{footer}
			</SidebarFooter>
		</>
	);
}

/**
 * `slots.sidebar.root`: the SaaS app's floating sidebar card (the same
 * `@fuutu/ui` sidebar parts, tokens and pill states) around the page tree;
 * a sheet from the left below `md`.
 *
 * One `@fuutu/ui` `SidebarProvider` gives the menu buttons their context.
 * It is driven by the fumadocs collapse state, so its Ctrl/Cmd+B shortcut
 * collapses the docs sidebar as it does in the app (it also writes the
 * host-only `sidebar_state` cookie, which the docs app never reads).
 */
export function DocsSidebar({
	className,
	banner,
	footer,
	components,
}: SidebarProps) {
	const { collapsed, setCollapsed } = useSidebar();
	const body = { banner, footer, components };

	return (
		<SidebarProvider
			open={!collapsed}
			onOpenChange={(open) => setCollapsed(!open)}
			className="contents"
		>
			<FumadocsSidebarContent>
				{({ ref, collapsed: isCollapsed }) => (
					<div
						data-sidebar-placeholder
						className="pointer-events-none sticky top-(--fd-docs-row-1) z-20 flex h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] justify-end [grid-area:sidebar] *:pointer-events-auto max-md:hidden md:layout:[--fd-sidebar-width:272px]"
					>
						<aside
							id="nd-sidebar"
							ref={ref}
							data-collapsed={isCollapsed}
							inert={isCollapsed}
							className={cn(
								// Transparent: the floating card sits on the page background,
								// as in the app. `!`: the fumadocs `#nd-sidebar` rule paints
								// it with the card color and an id selector beats a class.
								"h-full w-(--fd-sidebar-width) bg-transparent! p-2 transition-transform duration-200 motion-reduce:transition-none",
								isCollapsed && "-translate-x-full",
								className,
							)}
						>
							<div className="flex h-full w-full flex-col rounded-3xl bg-sidebar text-sidebar-foreground shadow-md ring-1 ring-sidebar-border/60">
								<SidebarBody mobile={false} {...body} />
							</div>
						</aside>
					</div>
				)}
			</FumadocsSidebarContent>
			<SidebarDrawerOverlay className="data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-black/80 data-[state=closed]:animate-out data-[state=open]:animate-in" />
			<SidebarDrawerContent className="data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85%] flex-col rounded-r-3xl bg-sidebar text-sidebar-foreground shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in">
				<SidebarBody mobile {...body} />
			</SidebarDrawerContent>
		</SidebarProvider>
	);
}
