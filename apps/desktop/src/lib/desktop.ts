import { isTauri } from "@tauri-apps/api/core";

/** True inside the Tauri webview (false in a plain browser / tests). */
export const inDesktop = (): boolean =>
	typeof window !== "undefined" && isTauri();

/**
 * Writes to the app's log file (tauri-plugin-log, `<log dir>/<bundle>.log`)
 * — outside Tauri it falls back to the console so nothing is lost.
 */
export async function logError(message: string, detail?: unknown) {
	const line =
		detail === undefined ? message : `${message}: ${describe(detail)}`;
	if (!inDesktop()) {
		console.error(line);
		return;
	}
	const { error } = await import("@tauri-apps/plugin-log");
	await error(line);
}

export async function logInfo(message: string) {
	if (!inDesktop()) return;
	const { info } = await import("@tauri-apps/plugin-log");
	await info(message);
}

function describe(detail: unknown): string {
	if (detail instanceof Error)
		return `${detail.name}: ${detail.message}\n${detail.stack ?? ""}`;
	try {
		return JSON.stringify(detail);
	} catch {
		return String(detail);
	}
}

/** Sends uncaught errors and rejections to the log file. Call once. */
export function captureGlobalErrors(): () => void {
	const onError = (event: ErrorEvent) =>
		void logError("uncaught error", event.error ?? event.message);
	const onRejection = (event: PromiseRejectionEvent) =>
		void logError("unhandled rejection", event.reason);
	window.addEventListener("error", onError);
	window.addEventListener("unhandledrejection", onRejection);
	return () => {
		window.removeEventListener("error", onError);
		window.removeEventListener("unhandledrejection", onRejection);
	};
}

/** Opens a URL in the system browser (never inside the app). */
export async function openExternal(url: string) {
	if (!inDesktop()) {
		window.open(url, "_blank", "noopener,noreferrer");
		return;
	}
	const { openUrl } = await import("@tauri-apps/plugin-opener");
	await openUrl(url);
}
