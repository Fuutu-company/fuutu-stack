"use client";

import { Label, Switch } from "@fuutu/ui";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { SettingsSection } from "@/components/settings-section";
import { inDesktop, logError } from "@/lib/desktop";

/** "Start at login" — the OS login item via tauri-plugin-autostart. */
export function AutostartSetting() {
	const t = useTranslations("desktop.settings.startup");
	const [enabled, setEnabled] = useState<boolean | null>(null);

	useEffect(() => {
		if (!inDesktop()) return;
		void import("@tauri-apps/plugin-autostart")
			.then(({ isEnabled }) => isEnabled())
			.then(setEnabled)
			.catch((err) => logError("autostart state", err));
	}, []);

	async function toggle(next: boolean) {
		try {
			const autostart = await import("@tauri-apps/plugin-autostart");
			await (next ? autostart.enable() : autostart.disable());
			setEnabled(await autostart.isEnabled());
		} catch (err) {
			await logError("autostart toggle", err);
		}
	}

	return (
		<SettingsSection title={t("title")} description={t("autostartHint")}>
			<div className="flex items-center gap-3">
				<Switch
					id="autostart"
					checked={enabled ?? false}
					disabled={enabled === null}
					onCheckedChange={(next) => void toggle(next)}
				/>
				<Label htmlFor="autostart">{t("autostart")}</Label>
			</div>
		</SettingsSection>
	);
}
