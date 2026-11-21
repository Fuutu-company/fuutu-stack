/** macOS permission prompts per locale (app-tauri-config.ts → `bundle.macOS.files`). */

/**
 * `bundle.macOS.files` entries for translated permission prompts: one
 * `<dir>/<locale>.lproj/InfoPlist.strings` per locale (paths relative to
 * src-tauri/), copied to `Contents/Resources/<locale>.lproj/`.
 */
export function localizedInfoPlistFiles(
	locales: readonly string[],
	dir = "macos",
): Record<string, string> {
	return Object.fromEntries(
		locales.map((locale) => [
			`Resources/${locale}.lproj/InfoPlist.strings`,
			`${dir}/${locale}.lproj/InfoPlist.strings`,
		]),
	);
}

/** Content of an InfoPlist.strings file (`"Key" = "Value";` per line). */
export function renderInfoPlistStrings(
	entries: Record<string, string>,
): string {
	const quote = (value: string) =>
		`"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
	return Object.entries(entries)
		.map(([key, value]) => `${quote(key)} = ${quote(value)};\n`)
		.join("");
}
