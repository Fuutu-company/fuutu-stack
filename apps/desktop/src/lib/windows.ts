import { config } from "@fuutu/config";
import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const ABOUT_LABEL = "about";

/** Opens (or focuses) the About window — a second Tauri webview. */
export async function openAboutWindow(): Promise<void> {
	if (!isTauri()) {
		window.open("/about/", "_blank", "noopener");
		return;
	}
	const existing = await WebviewWindow.getByLabel(ABOUT_LABEL);
	if (existing) {
		await existing.setFocus();
		return;
	}
	new WebviewWindow(ABOUT_LABEL, {
		url: "/about/",
		title: config.app.name,
		width: 480,
		height: 600,
		resizable: false,
		center: true,
	});
}
