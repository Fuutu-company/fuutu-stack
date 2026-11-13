"use client";

import type { Locale } from "@fuutu/i18n";
import { i18nConfig } from "@fuutu/i18n/config";
import { hasMultipleLocales } from "@fuutu/i18n/locale-utils";
import { cn } from "@fuutu/utils/cn";
import deFlag from "@iconify/icons-circle-flags/de";
import gbFlag from "@iconify/icons-circle-flags/gb";
import { Icon, type IconifyIcon } from "@iconify/react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "fumadocs-ui/components/ui/popover";
import type { LanguageSelectProps } from "fumadocs-ui/layouts/shared/slots/language-select";
import { LanguageSelectText } from "fumadocs-ui/layouts/shared/slots/language-select";
import { Check, ChevronDown } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { setUserLocale } from "@/modules/shared/actions/locale";
import { usePathname, useRouter } from "@/navigation";

// `Record<Locale, …>` forces a flag for every enabled locale; the `Partial`
// intersection keeps flags of dormant locales so re-enabling is config-only.
const FLAG_ICONS: Record<Locale, IconifyIcon> &
	Partial<Record<string, IconifyIcon>> = {
	en: gbFlag,
	de: deFlag,
};

/**
 * Fumadocs `slots.languageSelect.root`. Same popover chrome as the built-in
 * select, plus flags, and a switch that persists the locale cookie and keeps
 * the current path (the built-in `router.push` would be reverted by locale
 * detection because it never sets the cookie).
 */
export function LanguageSelect({
	className,
	variant = "ghost",
	children: _children,
	...rest
}: LanguageSelectProps) {
	const locale = useLocale() as Locale;
	const router = useRouter();
	const pathname = usePathname();
	const t = useTranslations("nav");
	const [open, setOpen] = useState(false);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	if (!hasMultipleLocales()) return null;

	const handleChange = (next: Locale) => {
		setOpen(false);
		if (next === locale) return;
		startTransition(async () => {
			await setUserLocale(next);
			router.replace(pathname, { locale: next });
		});
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				aria-label={t("switchLanguage")}
				disabled={isPending}
				className={cn(
					buttonVariants({ variant }),
					"gap-1.5 p-1.5 data-[state=open]:bg-fd-accent",
					className,
				)}
				{...rest}
			>
				<Icon icon={FLAG_ICONS[locale] ?? gbFlag} className="size-4.5" />
				<LanguageSelectText />
				<ChevronDown className="size-3.5 opacity-60 sm:ms-auto" />
			</PopoverTrigger>
			<PopoverContent className="flex flex-col gap-0.5 p-1">
				<p className="p-2 font-medium text-fd-muted-foreground text-xs">
					{t("switchLanguage")}
				</p>
				{Object.keys(i18nConfig.locales).map((loc) => (
					<button
						key={loc}
						type="button"
						onClick={() => handleChange(loc as Locale)}
						className={cn(
							"flex items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm transition-colors",
							loc === locale
								? "bg-fd-primary/10 text-fd-primary"
								: "text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground",
						)}
					>
						<Icon icon={FLAG_ICONS[loc] ?? gbFlag} className="size-4" />
						<span className="flex-1">
							{i18nConfig.locales[loc as Locale].label}
						</span>
						{loc === locale && <Check className="size-3.5" />}
					</button>
				))}
			</PopoverContent>
		</Popover>
	);
}
