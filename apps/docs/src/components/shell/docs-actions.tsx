"use client";

import { Button } from "@fuutu/ui";
import { cn } from "@fuutu/utils/cn";
import { useDocsLayout } from "fumadocs-ui/layouts/docs";
import type { IconItemType } from "fumadocs-ui/layouts/shared";
import { Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

/** Ghost icon toggle, as in the SaaS app's header. */
export function ThemeToggle() {
	const t = useTranslations("nav");
	const { resolvedTheme, setTheme } = useTheme();
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
			aria-label={t("toggleTheme")}
		>
			<Sun className="size-4 dark:hidden" />
			<Moon className="hidden size-4 dark:block" />
		</Button>
	);
}

/**
 * The icon links of the layout (`baseOptions().githubUrl` and any `links`
 * of type `icon`) and the theme toggle.
 */
export function DocsActions({ className }: { className?: string }) {
	const { menuItems } = useDocsLayout();
	const iconLinks = menuItems.filter(
		// A link without a label would have no accessible name.
		(item): item is IconItemType => item.type === "icon" && Boolean(item.label),
	);

	return (
		<div className={cn("flex items-center gap-1", className)}>
			{iconLinks.map((item) => (
				<Button
					key={item.url}
					asChild
					variant="ghost"
					size="icon"
					className="[&_svg]:size-4"
				>
					{item.external === false ? (
						<Link href={item.url} aria-label={item.label}>
							{item.icon}
						</Link>
					) : (
						<a
							href={item.url}
							target="_blank"
							rel="noreferrer noopener"
							aria-label={item.label}
						>
							{item.icon}
						</a>
					)}
				</Button>
			))}
			<ThemeToggle />
		</div>
	);
}
