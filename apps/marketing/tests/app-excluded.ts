/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Kit E2E tests your app does not run — e.g. specs for a kit demo feature
 * you removed — read by `playwright.config.ts`. Each entry is either
 *
 * - a file glob (ends in `.ts`/`.js` or contains `*`): skipped as a test
 *   file (`testIgnore`, matched under any folder), or
 * - a title: tests whose title line contains it are skipped
 *   (`grepInvert`, literal text — not a regex, case-sensitive). Playwright
 *   matches the project, file, describe and test names joined by spaces.
 *
 * Titles are case-sensitive literal substrings; entries ending in
 * `.ts`/`.js` or containing `*` are file globs. Blank entries are ignored.
 *
 * CLI filters (`--grep-invert "visual regression"` in CI) still apply on
 * top. Prefer deleting a whole spec you own; use this for kit specs so
 * kit updates keep merging cleanly.
 *
 * ```ts
 * export const appExcludedTests: string[] = ["crm.spec.ts", "Billing seat selector"];
 * ```
 */
export const appExcludedTests: string[] = [];
