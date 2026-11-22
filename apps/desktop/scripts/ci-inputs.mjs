#!/usr/bin/env node
/**
 * Prints the desktop workflow's app-owned inputs (`lib/app-ci.mjs`) as
 * `GITHUB_OUTPUT` lines — the gate job of `.github/workflows/desktop.yml`:
 *
 *   node apps/desktop/scripts/ci-inputs.mjs >> "$GITHUB_OUTPUT"
 *
 * Values reach `runs-on` and an `apt-get install` command line, so anything
 * beyond a plain runner label or package name is refused.
 */
import { pathToFileURL } from "node:url";

const RUNNER = /^[a-z0-9][a-z0-9.-]*$/;
// Debian package names (Policy §5.6.1), optional `=version` pin.
const PACKAGE = /^[a-z0-9][a-z0-9+.-]+(=[A-Za-z0-9.+~:-]+)?$/;

/**
 * @param {{ linuxRunner: string, linuxAptPackages: readonly string[] }} inputs
 * @returns {string}
 */
export function ciOutputs({ linuxRunner, linuxAptPackages }) {
	if (!RUNNER.test(linuxRunner)) {
		throw new Error(
			`app-ci.mjs: LINUX_RUNNER must be a runner label (got ${JSON.stringify(linuxRunner)})`,
		);
	}
	const bad = linuxAptPackages.filter((p) => !PACKAGE.test(p));
	if (bad.length > 0) {
		throw new Error(
			`app-ci.mjs: LINUX_APT_PACKAGES must be apt package names (got ${JSON.stringify(bad)})`,
		);
	}
	return `linux_runner=${linuxRunner}\nlinux_packages=${linuxAptPackages.join(" ")}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	const { LINUX_RUNNER, LINUX_APT_PACKAGES } = await import("./lib/app-ci.mjs");
	try {
		process.stdout.write(
			ciOutputs({
				linuxRunner: LINUX_RUNNER,
				linuxAptPackages: LINUX_APT_PACKAGES,
			}),
		);
	} catch (err) {
		process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
		process.exit(1);
	}
}
