"use client";

import { cn } from "@fuutu/utils/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { PropsWithChildren } from "react";

const TABS = [
	{ href: "/settings/", key: "settings" },
	{ href: "/settings/account/", key: "account" },
] as const;

export default function SettingsLayout({ children }: PropsWithChildren) {
	const t = useTranslations("desktop.shell.nav");
	const pathname = usePathname();
	return (
		<div className="mx-auto flex max-w-2xl flex-col gap-6 p-8">
			<nav className="flex gap-2" aria-label={t("settings")}>
				<Link href="/" className="text-muted-foreground text-sm">
					{t("home")}
				</Link>
				{TABS.map((tab) => (
					<Link
						key={tab.href}
						href={tab.href}
						className={cn(
							"text-sm",
							pathname === tab.href ? "font-semibold" : "text-muted-foreground",
						)}
					>
						{t(tab.key)}
					</Link>
				))}
			</nav>
			{children}
		</div>
	);
}
