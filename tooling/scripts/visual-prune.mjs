#!/usr/bin/env node
// Delete committed visual baselines that a finished update run did not
// rewrite (their spec, page, locale or viewport is gone). Run it right after
// `playwright test --update-snapshots=all` succeeded — never after a failed run.
//
//   node tooling/scripts/visual-prune.mjs --app <saas|marketing> --since <epoch ms> [--projects chromium,mobile-safari|all]

import { readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { BASELINE_PROJECTS, staleBaselines } from "./visual-local-lib.mjs";

const args = process.argv.slice(2);
const arg = (name) => {
	const i = args.indexOf(`--${name}`);
	return i !== -1 ? args[i + 1] : undefined;
};

const app = arg("app");
const since = Number(arg("since"));
const projectsArg = arg("projects");
if (!app || !Number.isFinite(since)) {
	console.error(
		"Usage: visual-prune.mjs --app <saas|marketing> --since <epoch ms> [--projects a,b|all]",
	);
	process.exit(2);
}
const projects =
	projectsArg === "all"
		? null
		: projectsArg
			? projectsArg.split(",")
			: BASELINE_PROJECTS;

const dir = path.resolve(
	import.meta.dirname,
	"../..",
	".fuutu",
	"visual-baselines",
	app,
);
const entries = readdirSync(dir).map((file) => ({
	file,
	mtimeMs: statSync(path.join(dir, file)).mtimeMs,
}));
for (const file of staleBaselines(entries, since, projects)) {
	rmSync(path.join(dir, file));
	console.log(`visual-prune: removed orphaned baseline ${app}/${file}`);
}
