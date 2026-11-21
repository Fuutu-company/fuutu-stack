import {
	type DesktopPlatform,
	type DesktopReleaseManifest,
	type DesktopTarget,
	desktopReleaseManifestSchema,
} from "@fuutu/desktop/updates";

/**
 * Turns `tauri build` outputs into the bucket layout read by the update
 * and download routes (`@fuutu/desktop/updates`):
 *
 *   <channel>/<version>/<file>   installers + updater bundles
 *   <channel>/latest.json        manifest (written last)
 *
 * CI hands one directory per build job, named after what it covers:
 * `macos-universal` (both darwin targets), `windows-x86_64`, `linux-x86_64`.
 */

export type BuildJob = "macos-universal" | "windows-x86_64" | "linux-x86_64";

const JOB_TARGETS: Record<BuildJob, readonly DesktopTarget[]> = {
	"macos-universal": ["darwin-aarch64", "darwin-x86_64"],
	"windows-x86_64": ["windows-x86_64"],
	"linux-x86_64": ["linux-x86_64"],
};

const JOB_PLATFORM: Record<BuildJob, DesktopPlatform> = {
	"macos-universal": "macos",
	"windows-x86_64": "windows",
	"linux-x86_64": "linux",
};

/** Updater bundle (signed, `.sig` next to it) and installer per job, by suffix. */
const PATTERNS: Record<BuildJob, { updater: RegExp; installer: RegExp }> = {
	"macos-universal": { updater: /\.app\.tar\.gz$/, installer: /\.dmg$/ },
	// NSIS: the setup .exe is the update bundle too (Tauri 2).
	"windows-x86_64": { updater: /-setup\.exe$/, installer: /-setup\.exe$/ },
	"linux-x86_64": { updater: /\.AppImage$/, installer: /\.AppImage$/ },
};

export const isBuildJob = (name: string): name is BuildJob =>
	Object.hasOwn(JOB_TARGETS, name);

export type JobFiles = {
	job: BuildJob;
	/** File names inside the job directory (bundle sub-directories flattened). */
	files: string[];
	/** `.sig` contents by updater bundle file name. */
	signatures: Record<string, string>;
};

export type ReleaseUpload = { file: string; job: BuildJob; key: string };

export type ReleasePlan = {
	uploads: ReleaseUpload[];
	manifest: DesktopReleaseManifest;
};

function pick(job: BuildJob, files: string[], pattern: RegExp, what: string) {
	const found = files.filter((f) => pattern.test(f));
	if (found.length !== 1) {
		throw new Error(
			`${job}: expected one ${what} (${pattern}), found ${found.length ? found.join(", ") : "none"}`,
		);
	}
	return found[0]!;
}

const baseName = (file: string) => file.split("/").pop()!;

/**
 * Upload list + manifest of one release. Throws on a missing or ambiguous
 * artifact or signature — a release is published whole or not at all.
 */
export function planRelease(input: {
	version: string;
	channel: string;
	notes?: string;
	pubDate: string;
	jobs: JobFiles[];
}): ReleasePlan {
	if (input.jobs.length === 0) throw new Error("no build artifacts");
	const prefix = `${input.channel}/${input.version}`;
	const uploads: ReleaseUpload[] = [];
	const platforms: DesktopReleaseManifest["platforms"] = {};
	const downloads: NonNullable<DesktopReleaseManifest["downloads"]> = {};

	for (const { job, files, signatures } of input.jobs) {
		const { updater, installer } = PATTERNS[job];
		const updaterFile = pick(job, files, updater, "updater bundle");
		const installerFile = pick(job, files, installer, "installer");
		const signature = signatures[updaterFile]?.trim();
		if (!signature) throw new Error(`${job}: ${updaterFile}.sig missing`);

		const updaterKey = `${prefix}/${baseName(updaterFile)}`;
		const installerKey = `${prefix}/${baseName(installerFile)}`;
		uploads.push({ file: updaterFile, job, key: updaterKey });
		if (installerKey !== updaterKey) {
			uploads.push({ file: installerFile, job, key: installerKey });
		}
		for (const target of JOB_TARGETS[job]) {
			// `url` is for the static source; the backend presigns `key`.
			platforms[target] = { signature, url: updaterKey, key: updaterKey };
		}
		downloads[JOB_PLATFORM[job]] = installerKey;
	}

	const manifest = desktopReleaseManifestSchema.parse({
		version: input.version,
		...(input.notes ? { notes: input.notes } : {}),
		pub_date: input.pubDate,
		platforms,
		downloads,
	});
	return { uploads, manifest };
}

/**
 * For `updates.source: "static"` the app fetches `url` itself — make it
 * absolute against the public base of the bucket.
 */
export function withPublicUrls(
	manifest: DesktopReleaseManifest,
	publicBase: string,
): DesktopReleaseManifest {
	const base = publicBase.replace(/\/+$/, "");
	return {
		...manifest,
		platforms: Object.fromEntries(
			Object.entries(manifest.platforms).map(([target, p]) => [
				target,
				{ ...p, url: `${base}/${p.key}` },
			]),
		),
	};
}
