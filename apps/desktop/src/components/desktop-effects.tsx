"use client";

import { desktopConfig } from "@fuutu/desktop/config";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { captureGlobalErrors, inDesktop, logError } from "@/lib/desktop";

/** App-wide side effects of the desktop shell (no UI). */
export function DesktopEffects() {
	const t = useTranslations("desktop.shell.tray");

	useEffect(() => captureGlobalErrors(), []);

	// Tray menu in the UI language.
	useEffect(() => {
		if (!inDesktop() || !desktopConfig.shell.tray) return;
		void import("@tauri-apps/api/core")
			.then(({ invoke }) =>
				invoke("shell_set_tray_labels", { show: t("show"), quit: t("quit") }),
			)
			.catch((err) => logError("tray labels", err));
	}, [t]);

	return null;
}
