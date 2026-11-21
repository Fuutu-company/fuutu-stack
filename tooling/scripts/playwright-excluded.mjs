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

/** Tag of the E2E specs that assert the kit's own demo (copy, look, layout). */
export const KIT_DEMO_TAG = "@kit-demo";

/**
 * Kit demo specs (`{ tag: "@kit-demo" }`) check the demo's own shape — a
 * buyer who replaces the landing page fails them. They run only when
 * `FUUTU_KIT_SOURCE=1` (kit CI sets it in the kit repository; kit
 * maintainers put it in `.env`); otherwise this adds the tag to
 * `grepInvert`, next to the app's title exclusions.
 *
 * @param {{ testIgnore?: string[]; grepInvert?: RegExp }} config
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ testIgnore?: string[]; grepInvert?: RegExp | RegExp[] }}
 */
export function withKitDemoFilter(config, env = process.env) {
	if (env.FUUTU_KIT_SOURCE === "1") return config;
	return {
		...config,
		grepInvert: [
			...(config.grepInvert ? [config.grepInvert] : []),
			new RegExp(escapeRegExp(KIT_DEMO_TAG)),
		],
	};
}
