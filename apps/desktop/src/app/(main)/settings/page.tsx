"use client";

import { desktopConfig } from "@fuutu/desktop/config";
import type { Locale } from "@fuutu/i18n";
import { getAllLocales, getLocaleConfig } from "@fuutu/i18n";
import {
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
import { SettingsSection } from "@/components/settings-section";
import { AutostartSetting } from "./autostart-setting";
import { UpdateSettings } from "./update-settings";

const THEMES = ["light", "dark", "system"] as const;

export default function SettingsPage() {
	const t = useTranslations("desktop.settings");
	const { locale, setLocale } = useDesktopLocale();
	const { theme, setTheme } = useTheme();
	return (
		<div className="mx-auto w-full max-w-4xl space-y-6">
			<PageHeader variant="compact" title={t("title")} />
			<SettingsSection
				title={t("appearance.title")}
				description={t("appearance.description")}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="theme">{t("appearance.theme")}</Label>
					<Select value={theme} onValueChange={setTheme}>
						<SelectTrigger id="theme" className="w-full sm:w-64">
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
				</div>
			</SettingsSection>
			<SettingsSection
				title={t("language.title")}
				description={t("language.description")}
			>
				<div className="flex flex-col gap-2">
					<Label htmlFor="language">{t("language.label")}</Label>
					<Select
						value={locale}
						onValueChange={(value) => setLocale(value as Locale)}
					>
						<SelectTrigger id="language" className="w-full sm:w-64">
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
				</div>
			</SettingsSection>
			{desktopConfig.shell.autostart ? <AutostartSetting /> : null}
			<UpdateSettings />
		</div>
	);
}
