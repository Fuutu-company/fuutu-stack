#!/usr/bin/env node
// Delete the committed visual baselines of one app that are orphaned by
// their name alone: a disabled locale, a page no visual spec names, a
// viewport on the wrong project class — the rules the guard test
// packages/test-utils/src/arch/visual-baselines.test.ts enforces.
//
// It never looks at what an update run rewrote: Playwright leaves a
// byte-identical render untouched, and a run covers only some apps and
// projects — "not rewritten" is not "orphaned".
//
//   node tooling/scripts/visual-prune.mjs --app <saas|marketing>

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { parseConfiguredLocales } from "../../packages/i18n/scripts/locales.mjs";
import { APPS, prunableOrphans } from "./visual-local-lib.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

const args = process.argv.slice(2);
const appIndex = args.indexOf("--app");
const app = appIndex !== -1 ? args[appIndex + 1] : undefined;
if (args.length !== 2 || !app || !APPS.includes(app)) {
	console.error(`Usage: visual-prune.mjs --app <${APPS.join("|")}>`);
	process.exit(2);
}

// Anything unreadable deletes nothing — an empty spec source or locale list
// would make every baseline look orphaned.
const fail = (message) => {
	console.error(`visual-prune: ${message} — nothing pruned.`);
	process.exit(1);
};

const locales = parseConfiguredLocales(
	readFileSync(path.join(ROOT, "packages", "i18n", "config.ts"), "utf8"),
);
if (!locales) fail("could not read i18nConfig.locales");

const testsDir = path.join(ROOT, "apps", app, "tests");
const specFiles = existsSync(testsDir)
	? readdirSync(testsDir).filter((f) => f.endsWith(".ts"))
	: [];
if (specFiles.length === 0) fail(`no specs in apps/${app}/tests`);
const specSource = specFiles
	.map((f) => readFileSync(path.join(testsDir, f), "utf8"))
	.join("\n");

const dir = path.join(ROOT, ".fuutu", "visual-baselines", app);
const files = existsSync(dir) ? readdirSync(dir) : [];
for (const file of prunableOrphans(files, { locales, specSource })) {
	rmSync(path.join(dir, file));
	console.log(`visual-prune: removed orphaned baseline ${app}/${file}`);
}
