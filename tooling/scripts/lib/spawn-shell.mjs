/**
 * `spawn` option for a command: on Windows a bare package-manager name
 * (`pnpm`, `npx`) is a `.cmd` shim that `spawn` finds only through a shell
 * (ENOENT otherwise; Node ≥ 20.12 refuses `.cmd` without one). A path —
 * `process.execPath`, maybe under "C:\Program Files" — runs without one,
 * so cmd.exe never splits it at the space.
 *
 * @param {string} command
 * @param {NodeJS.Platform} [platform]
 * @returns {{ shell: boolean }}
 */
export function shellOption(command, platform = process.platform) {
	return { shell: platform === "win32" && !/[\\/]/.test(command) };
}

/**
 * Arguments for `spawn` with `shellOption(command)`: through a shell Node
 * joins them with spaces, so one containing whitespace (a config path
 * under "C:\Users\Jane Doe") is quoted to stay one argument.
 *
 * @param {string} command
 * @param {string[]} args
 * @param {NodeJS.Platform} [platform]
 * @returns {string[]}
 */
export function shellArgs(command, args, platform = process.platform) {
	if (!shellOption(command, platform).shell) return args;
	return args.map((arg) => (/\s/.test(arg) ? `"${arg}"` : arg));
}
