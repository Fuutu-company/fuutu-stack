"use client";

import type { Locale } from "@fuutu/i18n";
import type { ThemeSwitchProps } from "fumadocs-ui/layouts/shared/slots/theme-switch";
import { ThemeSwitch } from "fumadocs-ui/layouts/shared/slots/theme-switch";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import { LocaleSwitcher } from "@/components/locale-switcher";

/**
 * Renders the locale switcher + theme switch together in the sidebar footer icon row.
 * Passed via `slots.themeSwitch` so Fumadocs places it in the same row as icon links.
 *
 * Fumadocs passes `ms-auto` to push the theme switch to the right. We override
 * it on the wrapper (`ms-0`) and re-apply `ms-auto` only to the ThemeSwitch,
 * so the LocaleSwitcher stays left next to the GitHub icon.
 */
export function SidebarActions({ className, ...props }: ThemeSwitchProps) {
	const locale = useLocale() as Locale;

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	return (
		<div className="ms-0 flex flex-1 items-center">
			<LocaleSwitcher />
			<ThemeSwitch className={`${className ?? ""} ms-auto`} {...props} />
		</div>
	);
}
