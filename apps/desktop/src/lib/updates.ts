import { inDesktop } from "./desktop";

/** In-app updates — the work happens in Rust (`src-tauri/src/updates.rs`). */

export type UpdatesStatus = {
	enabled: boolean;
	channels: string[];
	defaultChannel: string;
	checkIntervalHours: number;
	/** Linux package install: updates come through the package manager. */
	viaPackage: boolean;
};

export type UpdateInfo = {
	version: string;
	currentVersion: string;
	notes: string | null;
	date: string | null;
};

export type UpdateProgress = { downloaded: number; total: number | null };

export const UPDATE_PROGRESS_EVENT = "desktop://update-progress";

/** `updates_install` error of a debug build: downloaded + verified, not installed. */
export const DEBUG_NOT_INSTALLED =
	"debug build: update verified, not installed";

const CHANNEL_KEY = "desktop.updateChannel";

async function call<T>(command: string, args?: Record<string, unknown>) {
	const { invoke } = await import("@tauri-apps/api/core");
	return invoke<T>(command, args);
}

const OFF: UpdatesStatus = {
	enabled: false,
	channels: [],
	defaultChannel: "stable",
	checkIntervalHours: 0,
	viaPackage: false,
};

export const getUpdatesStatus = (): Promise<UpdatesStatus> =>
	inDesktop() ? call<UpdatesStatus>("updates_status") : Promise.resolve(OFF);

/** The chosen channel (settings), or `null` for the default. */
export function readChannel(): string | null {
	try {
		return window.localStorage.getItem(CHANNEL_KEY);
	} catch {
		return null;
	}
}

export function writeChannel(channel: string) {
	try {
		window.localStorage.setItem(CHANNEL_KEY, channel);
	} catch {
		// blocked storage: the default channel applies
	}
}

/** Newer version on `channel`, or `null`. */
export const checkForUpdate = (channel: string | null) =>
	call<UpdateInfo | null>("updates_check", { channel });

/** Downloads + installs the checked update, then restarts the app. */
export async function installUpdate(
	onProgress: (progress: UpdateProgress) => void,
): Promise<void> {
	const { listen } = await import("@tauri-apps/api/event");
	const off = await listen<UpdateProgress>(UPDATE_PROGRESS_EVENT, (event) =>
		onProgress(event.payload),
	);
	try {
		await call<void>("updates_install");
	} finally {
		off();
	}
	const { relaunch } = await import("@tauri-apps/plugin-process");
	await relaunch();
}
