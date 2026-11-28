/**
 * Files `pnpm assets:sync` leaves alone: `--skip=a,b` on the command line
 * plus the app-owned `packages/config/assets/keep.txt` (one filename per
 * line, `#` comments). The kit ships no keep.txt.
 */

/** Filenames listed in keep.txt. */
export function parseKeepFile(text) {
	return text
		.split(/\r?\n/)
		.map((line) => line.replace(/#.*$/, "").trim())
		.filter(Boolean);
}

/** filename → "--skip" | "keep.txt" (the reason it is left alone). */
export function assetSkips({ argv, keepText }) {
	const skips = new Map();
	for (const file of keepText ? parseKeepFile(keepText) : []) {
		skips.set(file, "keep.txt");
	}
	const arg = argv.find((a) => a.startsWith("--skip="));
	for (const file of arg ? arg.slice("--skip=".length).split(",") : []) {
		const name = file.trim();
		if (name) skips.set(name, "--skip");
	}
	return skips;
}
