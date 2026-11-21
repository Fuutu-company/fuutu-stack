"use client";

import { SidebarInset, SidebarProvider } from "@fuutu/ui";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PropsWithChildren } from "react";
import { appNavItems } from "@/app-nav";
import { appShellSlots } from "@/app-shell-slot";
import { buildNav, isNavActive } from "@/lib/nav";
import { AccessNotice } from "./access-gate";
import { AppHeader } from "./shell/app-header";
import { AppSidebar } from "./shell/app-sidebar";

// Kit items + yours (src/app-nav.ts); throws on a duplicate key.
const NAV = buildNav(appNavItems);
const {
	sidebarTop: SidebarTop,
	sidebarBottom: SidebarBottom,
	contentTop: ContentTop,
	global: Global,
} = appShellSlots;

/**
 * Main window frame — the SaaS app's shell: floating sidebar, header with
 * the page name, content column.
 */
export function AppShell({ children }: PropsWithChildren) {
	const t = useTranslations("desktop.shell");
	const pathname = usePathname();
	// The most specific matching item names the page (account beats settings).
	const current = NAV.filter((item) => isNavActive(pathname, item)).sort(
		(a, b) => b.href.length - a.href.length,
	)[0];
	return (
		<SidebarProvider
			labels={{
				mobileTitle: t("sidebar.title"),
				mobileDescription: t("sidebar.description"),
				toggle: t("sidebar.toggle"),
			}}
		>
			<AppSidebar nav={NAV} top={SidebarTop} bottom={SidebarBottom} />
			<SidebarInset className="min-w-0">
				<AppHeader
					title={current ? t(`nav.${current.titleKey}` as "nav.home") : null}
				/>
				<div className="min-w-0 flex-1 overflow-x-clip bg-background px-4 pt-4 pb-10 md:px-8 md:pt-0">
					<div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
						<AccessNotice />
						{ContentTop ? <ContentTop /> : null}
						{children}
					</div>
				</div>
			</SidebarInset>
			{Global ? <Global /> : null}
		</SidebarProvider>
	);
}
