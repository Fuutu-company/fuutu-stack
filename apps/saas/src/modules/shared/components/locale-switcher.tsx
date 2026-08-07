"use client";

import type { Locale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import {
	Button,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@fuutu/ui";
import deFlag from "@iconify/icons-circle-flags/de";
import gbFlag from "@iconify/icons-circle-flags/gb";
import { Icon, type IconifyIcon } from "@iconify/react";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setUserLocale } from "../actions/locale";

const FLAG_ICONS: Record<Locale, IconifyIcon> = {
	en: gbFlag,
	de: deFlag,
};

export function LocaleSwitcher() {
	const locale = useLocale() as Locale;
	const t = useTranslations("navigation");
	const [isPending, startTransition] = useTransition();

	const handleLocaleChange = (newLocale: Locale) => {
		startTransition(async () => {
			await setUserLocale(newLocale);
			window.location.reload();
		});
	};

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={isPending}
					className="gap-1.5 px-2"
					aria-label={t("aria.switchLanguage")}
				>
					<Icon icon={FLAG_ICONS[locale] ?? gbFlag} className="size-4" />
					<span className="font-medium text-xs uppercase">{locale}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{Object.keys(i18nConfig.locales).map((loc) => (
					<DropdownMenuItem
						key={loc}
						onClick={() => handleLocaleChange(loc as Locale)}
						className="gap-2"
					>
						<Icon
							icon={FLAG_ICONS[loc as Locale] ?? gbFlag}
							className="size-4"
						/>
						<span className="flex-1 text-sm">
							{i18nConfig.locales[loc as Locale].label}
						</span>
						<span className="text-muted-foreground text-xs uppercase">
							{loc}
						</span>
						{locale === loc && <Check className="size-3.5 text-primary" />}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
