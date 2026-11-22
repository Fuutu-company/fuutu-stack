import { describe, expect, it } from "vitest";
import { ciOutputs } from "../ci-inputs.mjs";

describe("desktop workflow inputs (app-owned scripts/lib/app-ci.mjs)", () => {
	it("hands the Linux runner and extra apt packages to the workflow", () => {
		expect(
			ciOutputs({
				linuxRunner: "ubuntu-24.04",
				linuxAptPackages: ["libpipewire-0.3-dev", "libclang-dev", "clang"],
			}),
		).toBe(
			"linux_runner=ubuntu-24.04\nlinux_packages=libpipewire-0.3-dev libclang-dev clang\n",
		);
		expect(
			ciOutputs({ linuxRunner: "ubuntu-22.04", linuxAptPackages: [] }),
		).toBe("linux_runner=ubuntu-22.04\nlinux_packages=\n");
	});

	it("refuses values that could change the workflow script", () => {
		for (const linuxRunner of ["", "ubuntu 24.04", "x\nlinux_packages=evil"]) {
			expect(() => ciOutputs({ linuxRunner, linuxAptPackages: [] })).toThrow(
				/LINUX_RUNNER/,
			);
		}
		for (const pkg of ["", "a b", "x;rm -rf /", "$(id)", "-y"]) {
			expect(() =>
				ciOutputs({ linuxRunner: "ubuntu-22.04", linuxAptPackages: [pkg] }),
			).toThrow(/LINUX_APT_PACKAGES/);
		}
	});
});
