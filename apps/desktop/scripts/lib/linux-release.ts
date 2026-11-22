import {
	DESKTOP_LINUX_FORMATS,
	type DesktopLinuxFormat,
} from "@fuutu/desktop/config";

/**
 * Linux release formats (`desktopConfig.release.linuxFormats`): which
 * bundles `tauri build` makes, and whether the build updates itself.
 */

export function assertLinuxFormats(
	formats: readonly DesktopLinuxFormat[],
): void {
	const known = DESKTOP_LINUX_FORMATS as readonly string[];
	if (formats.length === 0 || formats.some((f) => !known.includes(f))) {
		throw new Error(
			`desktopConfig.release.linuxFormats must list one or more of ${known.join(", ")} (got ${JSON.stringify(formats)})`,
		);
	}
}

/** Only an AppImage updates itself; packages update via the package manager. */
export const linuxSelfUpdates = (formats: readonly DesktopLinuxFormat[]) =>
	formats.includes("appimage");

/** `--bundles <formats>` for `tauri build`, unless `rest` names its own. */
export function linuxBundleArgs(
	formats: readonly DesktopLinuxFormat[],
	rest: readonly string[],
): string[] {
	assertLinuxFormats(formats);
	const explicit = rest.some(
		(arg) =>
			arg === "--bundles" || arg === "-b" || arg.startsWith("--bundles="),
	);
	return explicit ? [] : ["--bundles", formats.join(",")];
}
