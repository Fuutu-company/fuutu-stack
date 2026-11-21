"use client";

import type { Locale } from "@fuutu/i18n";
import { getAllLocales, getLocaleConfig } from "@fuutu/i18n";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@fuutu/ui";
import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDesktopLocale } from "../intl-provider";

/** App language in the header (the same choice as Settings → Language). */
export function LocaleMenu() {
	const t = useTranslations("desktop.shell.header");
	const { locale, setLocale } = useDesktopLocale();
	const locales = getAllLocales();
	if (locales.length < 2) return null;
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label={t("language")}>
					<Languages className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-40">
				<DropdownMenuRadioGroup
					value={locale}
					onValueChange={(value) => setLocale(value as Locale)}
				>
					{locales.map((code) => (
						<DropdownMenuRadioItem key={code} value={code}>
							{getLocaleConfig(code).label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
