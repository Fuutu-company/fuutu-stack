// Pure helper for the kit Playwright configs — turns an app's
// `appExcludedTests` (apps/<app>/tests/app-excluded.ts) into config fields.
// Unit-tested in packages/test-utils/src/arch/app-excluded-tests.test.ts.

/** A file glob ends in a script extension or contains `*`; anything else is a title. */
const isFileGlob = (entry) =>
	entry.includes("*") || /\.[cm]?[jt]sx?$/.test(entry);

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * File globs → `testIgnore` (Playwright matches them under any folder),
 * titles → `grepInvert` (literal substring of the full test title).
 * An empty list returns `{}`, so the config is unchanged. CLI
 * `--grep-invert` is a separate filter and applies on top.
 *
 * Blank entries are dropped.
 *
 * @param {readonly string[]} rawEntries
 * @returns {{ testIgnore?: string[]; grepInvert?: RegExp }}
 */
export function excludedTestsConfig(rawEntries) {
	// An empty entry would compile to a pattern matching every title.
	const entries = rawEntries.map((e) => e.trim()).filter((e) => e !== "");
	const files = entries.filter(isFileGlob);
	const titles = entries.filter((entry) => !isFileGlob(entry));
	return {
		...(files.length > 0 ? { testIgnore: files } : {}),
		...(titles.length > 0
			? { grepInvert: new RegExp(titles.map(escapeRegExp).join("|")) }
			: {}),
	};
}
