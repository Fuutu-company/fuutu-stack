import { describe, expect, it } from "vitest";
import { type JobFiles, planRelease, withPublicUrls } from "../lib/release";

const mac: JobFiles = {
	job: "macos-universal",
	files: [
		"macos/Acme.app.tar.gz",
		"macos/Acme.app.tar.gz.sig",
		"dmg/Acme_1.2.0_universal.dmg",
	],
	signatures: { "macos/Acme.app.tar.gz": "SIGMAC\n" },
};
const win: JobFiles = {
	job: "windows-x86_64",
	files: ["nsis/Acme_1.2.0_x64-setup.exe", "nsis/Acme_1.2.0_x64-setup.exe.sig"],
	signatures: { "nsis/Acme_1.2.0_x64-setup.exe": "SIGWIN" },
};

const plan = (jobs = [mac, win]) =>
	planRelease({
		version: "1.2.0",
		channel: "stable",
		notes: "Fixes",
		pubDate: "2026-11-21T00:00:00Z",
		jobs,
	});

describe("planRelease", () => {
	it("maps build outputs to the bucket layout and the manifest", () => {
		const { uploads, manifest } = plan();
		expect(uploads.map((u) => u.key)).toEqual([
			"stable/1.2.0/Acme.app.tar.gz",
			"stable/1.2.0/Acme_1.2.0_universal.dmg",
			"stable/1.2.0/Acme_1.2.0_x64-setup.exe",
		]);
		// A universal macOS build serves both darwin targets.
		expect(manifest.platforms["darwin-aarch64"]).toEqual({
			signature: "SIGMAC",
			url: "stable/1.2.0/Acme.app.tar.gz",
			key: "stable/1.2.0/Acme.app.tar.gz",
		});
		expect(manifest.platforms["darwin-x86_64"]?.key).toBe(
			"stable/1.2.0/Acme.app.tar.gz",
		);
		expect(manifest.downloads).toEqual({
			macos: "stable/1.2.0/Acme_1.2.0_universal.dmg",
			windows: "stable/1.2.0/Acme_1.2.0_x64-setup.exe",
		});
		expect(manifest.notes).toBe("Fixes");
	});

	it("refuses a release with a missing signature, artifact or ambiguity", () => {
		expect(() => plan([{ ...mac, signatures: {} }])).toThrow(/\.sig missing/);
		expect(() => plan([{ ...mac, files: ["dmg/A.dmg"] }])).toThrow(
			/updater bundle/,
		);
		expect(() =>
			plan([{ ...mac, files: [...mac.files, "dmg/B.dmg"] }]),
		).toThrow(/expected one installer/);
		expect(() => plan([])).toThrow(/no build artifacts/);
	});

	it("makes updater URLs absolute for the static source", () => {
		const manifest = withPublicUrls(
			plan().manifest,
			"https://cdn.example.com/rel/",
		);
		expect(manifest.platforms["windows-x86_64"]?.url).toBe(
			"https://cdn.example.com/rel/stable/1.2.0/Acme_1.2.0_x64-setup.exe",
		);
	});
});
