import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	shellArgs,
	shellOption,
} from "../../../../tooling/scripts/lib/spawn-shell.mjs";

const root = join(import.meta.dirname, "../../../..");

/**
 * `pnpm build:desktop` on Windows died with `spawn pnpm ENOENT`: pnpm is a
 * `.cmd` shim there, reachable only through a shell.
 */
describe("desktop launchers spawn pnpm through a shell on Windows", () => {
	it("uses a shell for a bare command on win32 only", () => {
		expect(shellOption("pnpm", "win32")).toEqual({ shell: true });
		expect(shellOption("pnpm", "darwin")).toEqual({ shell: false });
		expect(shellOption("pnpm", "linux")).toEqual({ shell: false });
	});

	it("runs a path (node under Program Files) without a shell", () => {
		expect(shellOption("C:\\Program Files\\nodejs\\node.exe", "win32")).toEqual(
			{ shell: false },
		);
	});

	it("quotes an argument with a space when a shell joins them", () => {
		const args = ["--config", "C:\\Users\\Jane Doe\\tauri.json"];
		expect(shellArgs("pnpm", args, "win32")).toEqual([
			"--config",
			'"C:\\Users\\Jane Doe\\tauri.json"',
		]);
		expect(shellArgs("pnpm", args, "darwin")).toEqual(args);
	});

	it.each(["tooling/scripts/desktop.mjs", "apps/desktop/scripts/run.ts"])(
		"%s passes the option to spawn",
		(file) => {
			const source = readFileSync(join(root, file), "utf8");
			expect(source).toMatch(/\.\.\.shellOption\(("pnpm"|command)\)/);
		},
	);
});
