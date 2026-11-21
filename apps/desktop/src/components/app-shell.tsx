"use client";

import { config } from "@fuutu/config";
import { cn } from "@fuutu/utils/cn";
import { Info } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PropsWithChildren } from "react";
import { appNavItems } from "@/app-nav";
import { appShellSlots } from "@/app-shell-slot";
import { buildNav, isNavActive } from "@/lib/nav";
import { openAboutWindow } from "@/lib/windows";
import { AccessNotice } from "./access-gate";

// Kit items + yours (src/app-nav.ts); throws on a duplicate key.
const NAV = buildNav(appNavItems);
const {
	sidebarTop: SidebarTop,
	sidebarBottom: SidebarBottom,
	contentTop: ContentTop,
	global: Global,
} = appShellSlots;

/** Main window frame: sidebar navigation + content area. */
export function AppShell({ children }: PropsWithChildren) {
	const t = useTranslations("desktop.shell.nav");
	const pathname = usePathname();
	return (
		<div className="flex h-screen">
			<aside className="flex w-56 shrink-0 flex-col border-sidebar-border border-r bg-sidebar text-sidebar-foreground">
				<div className="px-4 py-5 font-heading font-semibold">
					{config.app.name}
				</div>
				{SidebarTop ? <SidebarTop /> : null}
				<nav aria-label={t("primary")} className="flex flex-col gap-1 px-2">
					{NAV.map((item) => {
						const { href, titleKey, icon: Icon } = item;
						const active = isNavActive(pathname, item);
						return (
							<Link
								key={href}
								href={href}
								aria-current={active ? "page" : undefined}
								className={cn(
									"flex items-center gap-2 rounded-md px-3 py-2 text-sm",
									active
										? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
										: "text-sidebar-foreground/80 hover:bg-sidebar-accent",
								)}
							>
								<Icon className="size-4" aria-hidden />
								{t(titleKey as "home")}
							</Link>
						);
					})}
				</nav>
				<div className="mt-auto px-2 pb-4">
					{SidebarBottom ? <SidebarBottom /> : null}
					<button
						type="button"
						onClick={() => void openAboutWindow()}
						className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sidebar-foreground/80 text-sm hover:bg-sidebar-accent"
					>
						<Info className="size-4" aria-hidden />
						{t("about")}
					</button>
				</div>
			</aside>
			<main className="min-w-0 flex-1 overflow-y-auto">
				<div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
					<AccessNotice />
					{ContentTop ? <ContentTop /> : null}
					{children}
				</div>
			</main>
			{Global ? <Global /> : null}
		</div>
	);
}
