"use client";

import { config } from "@fuutu/config";
import { cn } from "@fuutu/utils/cn";
import { House, Info, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PropsWithChildren } from "react";
import { openAboutWindow } from "@/lib/windows";

const NAV = [
	{ href: "/", key: "home", icon: House },
	{ href: "/settings/", key: "settings", icon: Settings },
	{ href: "/settings/account/", key: "account", icon: UserRound },
] as const;

function isActive(pathname: string, href: string) {
	if (href === "/") return pathname === "/";
	if (href === "/settings/") return pathname === "/settings/";
	return pathname.startsWith(href);
}

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
				<nav aria-label={t("primary")} className="flex flex-col gap-1 px-2">
					{NAV.map(({ href, key, icon: Icon }) => (
						<Link
							key={href}
							href={href}
							aria-current={isActive(pathname, href) ? "page" : undefined}
							className={cn(
								"flex items-center gap-2 rounded-md px-3 py-2 text-sm",
								isActive(pathname, href)
									? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
									: "text-sidebar-foreground/80 hover:bg-sidebar-accent",
							)}
						>
							<Icon className="size-4" aria-hidden />
							{t(key)}
						</Link>
					))}
				</nav>
				<div className="mt-auto px-2 pb-4">
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
					{children}
				</div>
			</main>
		</div>
	);
}
