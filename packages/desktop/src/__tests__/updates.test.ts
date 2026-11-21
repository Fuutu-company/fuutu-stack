import { describe, expect, it } from "vitest";
import {
	compareVersions,
	type DesktopReleaseManifest,
	decideDownload,
	decideUpdate,
	manifestKey,
	parseManifest,
	updaterTarget,
} from "../updates";

const MANIFEST: DesktopReleaseManifest = {
	version: "2.1.0",
	notes: "Faster sync",
	pub_date: "2026-11-20T10:00:00Z",
	platforms: {
		"darwin-aarch64": {
			signature: "sig-mac",
			url: "stable/2.1.0/Acme.app.tar.gz",
			key: "stable/2.1.0/Acme.app.tar.gz",
		},
		"windows-x86_64": {
			signature: "sig-win",
			url: "stable/2.1.0/Acme_2.1.0_x64-setup.exe",
			key: "stable/2.1.0/Acme_2.1.0_x64-setup.exe",
		},
	},
	downloads: { macos: "stable/2.1.0/Acme_2.1.0_universal.dmg" },
};

describe("compareVersions", () => {
	it("orders semver incl. pre-releases", () => {
		expect(compareVersions("2.1.0", "2.0.9")).toBe(1);
		expect(compareVersions("2.1.0", "2.1.0")).toBe(0);
		expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
		expect(compareVersions("2.0.0-beta.2", "2.0.0-beta.10")).toBe(-1);
		expect(compareVersions("2.0.0-beta.1", "2.0.0")).toBe(-1);
		expect(compareVersions("v2.0.0", "2.0.0")).toBe(0);
	});
});

describe("updaterTarget", () => {
	it("accepts only the shipped platforms", () => {
		expect(updaterTarget("darwin", "aarch64")).toBe("darwin-aarch64");
		expect(updaterTarget("windows", "x86_64")).toBe("windows-x86_64");
		expect(updaterTarget("linux", "x86_64")).toBe("linux-x86_64");
		expect(updaterTarget("linux", "armv7")).toBeNull();
		expect(updaterTarget("../x", "x86_64")).toBeNull();
	});
});

describe("decideUpdate", () => {
	const base = {
		manifest: MANIFEST,
		target: "darwin-aarch64" as const,
		maxLicensedMajor: null,
	};

	it("offers a newer version for the platform", () => {
		expect(decideUpdate({ ...base, currentVersion: "2.0.3" })).toEqual({
			version: "2.1.0",
			notes: "Faster sync",
			pub_date: "2026-11-20T10:00:00Z",
			signature: "sig-mac",
			key: "stable/2.1.0/Acme.app.tar.gz",
		});
	});

	it("offers nothing when current, newer, or without a build for the platform", () => {
		expect(decideUpdate({ ...base, currentVersion: "2.1.0" })).toBeNull();
		expect(decideUpdate({ ...base, currentVersion: "3.0.0" })).toBeNull();
		expect(
			decideUpdate({
				...base,
				target: "linux-x86_64",
				currentVersion: "1.0.0",
			}),
		).toBeNull();
	});

	it("never offers a major above the licence", () => {
		expect(
			decideUpdate({ ...base, currentVersion: "1.4.0", maxLicensedMajor: 1 }),
		).toBeNull();
		expect(
			decideUpdate({ ...base, currentVersion: "2.0.0", maxLicensedMajor: 2 }),
		).not.toBeNull();
	});
});

describe("decideDownload", () => {
	it("returns the installer key of a platform, or null", () => {
		expect(decideDownload(MANIFEST, "macos")).toBe(
			"stable/2.1.0/Acme_2.1.0_universal.dmg",
		);
		expect(decideDownload(MANIFEST, "linux")).toBeNull();
	});
});

describe("parseManifest / manifestKey", () => {
	it("validates the manifest and keeps keys inside the channel", () => {
		expect(parseManifest(JSON.stringify(MANIFEST))).toEqual(MANIFEST);
		expect(parseManifest("{")).toBeNull();
		expect(
			parseManifest(
				JSON.stringify({
					...MANIFEST,
					platforms: {
						"darwin-aarch64": { signature: "s", url: "u", key: "../secret" },
					},
				}),
			),
		).toBeNull();
		expect(manifestKey("beta")).toBe("beta/latest.json");
	});
});
