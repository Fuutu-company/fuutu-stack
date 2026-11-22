import { describe, expect, it } from "vitest";
import { linuxBundleArgs, linuxSelfUpdates } from "../lib/linux-release";

describe("Linux release formats (desktopConfig.release.linuxFormats)", () => {
	it("an AppImage is the only Linux build that updates itself", () => {
		expect(linuxSelfUpdates(["appimage", "deb"])).toBe(true);
		expect(linuxSelfUpdates(["deb", "rpm"])).toBe(false);
	});

	it("bundles the configured formats unless the command line names its own", () => {
		expect(linuxBundleArgs(["appimage", "deb"], [])).toEqual([
			"--bundles",
			"appimage,deb",
		]);
		expect(linuxBundleArgs(["deb", "rpm"], ["--verbose"])).toEqual([
			"--bundles",
			"deb,rpm",
		]);
		for (const rest of [
			["--bundles", "deb"],
			["-b", "deb"],
			["--bundles=deb"],
		]) {
			expect(linuxBundleArgs(["deb", "rpm"], rest)).toEqual([]);
		}
	});

	it("refuses an empty or unknown format list", () => {
		expect(() => linuxBundleArgs([], [])).toThrow(/linuxFormats/);
		expect(() => linuxBundleArgs(["snap" as never], [])).toThrow(
			/linuxFormats/,
		);
	});
});
