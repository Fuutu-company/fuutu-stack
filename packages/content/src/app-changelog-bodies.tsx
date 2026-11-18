import type { ComponentType } from "react";
import ChangelogExample from "./changelog/example";
import ChangelogExampleDe from "./changelog/example.de";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Body components per changelog slug and locale, for every entry in
 * `./app-changelog.ts` (a missing slug throws at load). Unknown locales
 * fall back to `en`.
 */
export const appChangelogBodies: Record<
	string,
	Record<string, ComponentType>
> = {
	example: { en: ChangelogExample, de: ChangelogExampleDe },
};
