import { z } from "zod";
import type { DesktopChannel, DesktopLinuxFormat } from "./config";

/**
 * Desktop releases in storage (bucket `desktopReleases`), written by
 * `apps/desktop/scripts/publish.ts`, read by the saas update/download
 * routes — and, with `updates.source: "static"`, by the app directly:
 *
 *   <channel>/<version>/<file>        installers + updater bundles (+ .sig)
 *   <channel>/latest.json             this manifest
 *
 * The manifest is Tauri's static updater format (`version`, `notes`,
 * `pub_date`, `platforms[<os>-<arch>].{url, signature}`) plus `key` per
 * platform (the object in the bucket) and `downloads` (installers for the
 * download page) — Tauri ignores the extra fields.
 */

/** Updater targets the kit builds (CI matrix). */
export const DESKTOP_TARGETS = [
	"darwin-aarch64",
	"darwin-x86_64",
	"windows-x86_64",
	"linux-x86_64",
] as const;
export type DesktopTarget = (typeof DESKTOP_TARGETS)[number];

/** Download-page platforms. */
export const DESKTOP_PLATFORMS = ["macos", "windows", "linux"] as const;
export type DesktopPlatform = (typeof DESKTOP_PLATFORMS)[number];

/** Object key inside the channel — no traversal, no absolute paths. */
const objectKey = z
	.string()
	.min(1)
	.max(512)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._\-/+ ]*$/)
	.refine((key) => !key.split("/").includes(".."), "no ..");

export const desktopReleaseManifestSchema = z.object({
	version: z.string().min(1).max(64),
	notes: z.string().max(10_000).optional(),
	pub_date: z.string().optional(),
	platforms: z.record(
		z.string(),
		z.object({ signature: z.string(), url: z.string(), key: objectKey }),
	),
	downloads: z
		.object({
			macos: objectKey.optional(),
			windows: objectKey.optional(),
			linux: objectKey.optional(),
		})
		.optional(),
});

export type DesktopReleaseManifest = z.infer<
	typeof desktopReleaseManifestSchema
>;

export const manifestKey = (channel: DesktopChannel) =>
	`${channel}/latest.json`;

export function parseManifest(raw: string): DesktopReleaseManifest | null {
	try {
		const parsed = desktopReleaseManifestSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

/** `{{target}}` / `{{arch}}` of the Tauri updater → a shipped target. */
export function updaterTarget(
	target: string,
	arch: string,
): DesktopTarget | null {
	const key = `${target}-${arch}`;
	return (DESKTOP_TARGETS as readonly string[]).includes(key)
		? (key as DesktopTarget)
		: null;
}

type ParsedVersion = { core: number[]; pre: (number | string)[] };

function parseVersion(version: string): ParsedVersion {
	const [core = "", pre] = version
		.replace(/^v/, "")
		.split("+")[0]!
		.split(/-(.*)/);
	return {
		core: core.split(".").map((part) => Number.parseInt(part, 10) || 0),
		pre: pre
			? pre.split(".").map((part) => (/^\d+$/.test(part) ? Number(part) : part))
			: [],
	};
}

/** Semver order: -1, 0 or 1. A pre-release sorts before its release. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
	const x = parseVersion(a);
	const y = parseVersion(b);
	for (let i = 0; i < 3; i++) {
		const d = (x.core[i] ?? 0) - (y.core[i] ?? 0);
		if (d !== 0) return d > 0 ? 1 : -1;
	}
	if (!x.pre.length || !y.pre.length) {
		if (x.pre.length === y.pre.length) return 0;
		return x.pre.length ? -1 : 1;
	}
	for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
		const p = x.pre[i];
		const q = y.pre[i];
		if (p === undefined) return -1;
		if (q === undefined) return 1;
		if (p === q) continue;
		if (typeof p === "number" && typeof q === "number") return p > q ? 1 : -1;
		if (typeof p === "number") return -1;
		if (typeof q === "number") return 1;
		return p > q ? 1 : -1;
	}
	return 0;
}

export const majorOf = (version: string) => parseVersion(version).core[0] ?? 0;

export type DesktopUpdate = {
	version: string;
	notes?: string;
	pub_date?: string;
	signature: string;
	/** Object key — the route turns it into a short-lived URL. */
	key: string;
};

/**
 * The update a running app gets: the manifest's version when it is newer,
 * built for the app's platform and — with per-major licensing — within the
 * licensed major (an app never updates itself into a version it may not
 * run). `null` = no update (HTTP 204).
 */
export function decideUpdate(input: {
	manifest: DesktopReleaseManifest;
	target: DesktopTarget;
	currentVersion: string;
	maxLicensedMajor: number | null;
}): DesktopUpdate | null {
	const { manifest } = input;
	if (compareVersions(manifest.version, input.currentVersion) <= 0) return null;
	if (
		input.maxLicensedMajor !== null &&
		majorOf(manifest.version) > input.maxLicensedMajor
	) {
		return null;
	}
	const platform = manifest.platforms[input.target];
	if (!platform) return null;
	return {
		version: manifest.version,
		...(manifest.notes !== undefined && { notes: manifest.notes }),
		...(manifest.pub_date !== undefined && { pub_date: manifest.pub_date }),
		signature: platform.signature,
		key: platform.key,
	};
}

/** Installer key for the download page, or `null`. */
export function decideDownload(
	manifest: DesktopReleaseManifest,
	platform: DesktopPlatform,
): string | null {
	return manifest.downloads?.[platform] ?? null;
}

const LINUX_FORMAT_SUFFIX: [RegExp, DesktopLinuxFormat][] = [
	[/\.AppImage$/, "appimage"],
	[/\.deb$/, "deb"],
	[/\.rpm$/, "rpm"],
];

/**
 * Format of the Linux download (`desktopConfig.release.linuxFormats`), for
 * the download page's requirements line; `null` without one.
 */
export function linuxDownloadFormat(
	manifest: DesktopReleaseManifest,
): DesktopLinuxFormat | null {
	const key = manifest.downloads?.linux;
	if (!key) return null;
	return LINUX_FORMAT_SUFFIX.find(([suffix]) => suffix.test(key))?.[1] ?? null;
}
