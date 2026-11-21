"use client";

import { desktopConfig } from "@fuutu/desktop/config";
import type { Locale } from "@fuutu/i18n";
import { getAllLocales, getLocaleConfig } from "@fuutu/i18n";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Label,
	PageHeader,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useDesktopLocale } from "@/components/intl-provider";
import { AutostartSetting } from "./autostart-setting";

const THEMES = ["light", "dark", "system"] as const;

export default function SettingsPage() {
	const t = useTranslations("desktop.settings");
	const { locale, setLocale } = useDesktopLocale();
	const { theme, setTheme } = useTheme();
	return (
		<>
			<PageHeader title={t("title")} description={t("description")} />
			<Card>
				<CardHeader>
					<CardTitle>{t("appearance.title")}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					<Label htmlFor="theme">{t("appearance.theme")}</Label>
					<Select value={theme} onValueChange={setTheme}>
						<SelectTrigger id="theme" className="w-60">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{THEMES.map((mode) => (
								<SelectItem key={mode} value={mode}>
									{t(`appearance.themes.${mode}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>{t("language.title")}</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					<Label htmlFor="language">{t("language.label")}</Label>
					<Select
						value={locale}
						onValueChange={(value) => setLocale(value as Locale)}
					>
						<SelectTrigger id="language" className="w-60">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{getAllLocales().map((code) => (
								<SelectItem key={code} value={code}>
									{getLocaleConfig(code).label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
			</Card>
			{desktopConfig.shell.autostart ? <AutostartSetting /> : null}
		</>
	);
}
