"use client";

import { Button } from "@fuutu/ui";
import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

export function ThemeToggle() {
	const t = useTranslations("navigation");
	const { theme, setTheme } = useTheme();
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			aria-label={t("aria.toggleTheme")}
		>
			<Sun className="size-4 dark:hidden" />
			<Moon className="hidden size-4 dark:block" />
		</Button>
	);
}
