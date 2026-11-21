"use client";

import type { Locale } from "@fuutu/i18n";
import { getAllLocales } from "@fuutu/i18n";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useDesktopLocale } from "@/components/intl-provider";

export default function SettingsPage() {
	const t = useTranslations("desktop.settings");
	const { locale, setLocale } = useDesktopLocale();
	const { theme, setTheme } = useTheme();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("title")}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<Label htmlFor="theme">{t("appearance.theme")}</Label>
					<Select value={theme} onValueChange={setTheme}>
						<SelectTrigger id="theme">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(["light", "dark", "system"] as const).map((mode) => (
								<SelectItem key={mode} value={mode}>
									{t(`appearance.themes.${mode}`)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col gap-2">
					<Label htmlFor="language">{t("language.label")}</Label>
					<Select
						value={locale}
						onValueChange={(value) => setLocale(value as Locale)}
					>
						<SelectTrigger id="language">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{getAllLocales().map((code) => (
								<SelectItem key={code} value={code}>
									{code}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</CardContent>
		</Card>
	);
}
