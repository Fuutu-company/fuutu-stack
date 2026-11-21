"use client";

import { Button } from "@fuutu/ui";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

/** Light ↔ dark, like the SaaS app header (Settings keeps "System"). */
export function ThemeToggle() {
	const t = useTranslations("desktop.shell.header");
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
