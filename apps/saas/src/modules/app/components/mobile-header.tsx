"use client";

import { BrandLogo, Button, useSidebar } from "@fuutu/ui";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function MobileHeader() {
	const t = useTranslations();
	const tNav = useTranslations("navigation");
	const { toggleSidebar } = useSidebar();

	return (
		<header className="sticky top-0 z-50 flex h-12 items-center justify-between border-b bg-background px-4 md:hidden">
			<Link href="/dashboard" className="flex items-center gap-2.5">
				<BrandLogo
					size="md"
					alt={t("app.brand")}
					className="size-7 dark:invert"
				/>
				<span className="font-semibold text-foreground text-sm tracking-tight">
					{t("app.brand")}
				</span>
			</Link>
			<Button
				variant="ghost"
				size="icon"
				className="h-8 w-8"
				onClick={toggleSidebar}
				aria-label={tNav("aria.toggleNavigation")}
			>
				<Menu className="size-5" />
			</Button>
		</header>
	);
}
