#!/usr/bin/env node
// Assemble the GitHub Pages site for visual reports (Pages source: "GitHub
// Actions" — no gh-pages branch). Called by .github/workflows/pages.yml.
//   1. Restore the live site from the latest `github-pages` artifact. First
//      run only: fall back to a legacy gh-pages branch, if one exists.
//   2. Add this run's reports: --add <dir>/<app>=<report-dir> (repeatable).
//   3. Prune pr-<N>/ dirs of closed PRs.
//   4. Regenerate the index pages (visual-pages-index.mjs).
// Usage: node tooling/scripts/ci-pages-site.mjs --site <dir> [--add <dest>=<src>]...
// Needs GH_TOKEN (actions:read, pull-requests:read) and GITHUB_REPOSITORY.

import { execFileSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const META_FILE = "pages-meta.json";
const ARTIFACT = "github-pages";

const argv = process.argv.slice(2);
let site;
const adds = [];
for (let i = 0; i < argv.length; i++) {
	if (argv[i] === "--site") site = argv[++i];
	else if (argv[i] === "--add") adds.push(argv[++i]);
}
const repo = process.env.GITHUB_REPOSITORY;
if (!site || !repo) {
	console.error(
		"Usage: ci-pages-site.mjs --site <dir> [--add <dest>=<src>]... (GITHUB_REPOSITORY required)",
	);
	process.exit(2);
}

const run = (cmd, args, opts = {}) =>
	execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 28, ...opts });
const gh = (...args) => run("gh", ["api", ...args]);
const sh = (script) => run("sh", ["-c", script], { stdio: "inherit" });

rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

// 1 · Restore -----------------------------------------------------------
function restoreFromArtifact() {
	const { artifacts = [] } = JSON.parse(
		gh(`repos/${repo}/actions/artifacts?name=${ARTIFACT}&per_page=30`),
	);
	const latest = artifacts.find((a) => !a.expired);
	if (!latest) return false;
	const tmp = mkdtempSync(path.join(tmpdir(), "pages-"));
	const zip = path.join(tmp, "site.zip");
	run("sh", [
		"-c",
		`gh api "repos/${repo}/actions/artifacts/${latest.id}/zip" > "${zip}"`,
	]);
	sh(`unzip -p "${zip}" artifact.tar | tar -x -C "${site}"`);
	rmSync(tmp, { recursive: true, force: true });
	console.log(
		`restored site from artifact #${latest.id} (${latest.created_at})`,
	);
	return true;
}

function restoreFromLegacyBranch() {
	try {
		run("git", ["fetch", "--depth=1", "origin", "gh-pages"], {
			stdio: "ignore",
		});
	} catch {
		return false;
	}
	sh(`git archive FETCH_HEAD | tar -x -C "${site}"`);
	console.log(
		"restored site from the legacy gh-pages branch — delete that branch once this deploy succeeded",
	);
	return true;
}

let restored = false;
try {
	restored = restoreFromArtifact();
} catch (err) {
	console.warn(
		`::warning::Could not restore the previous site: ${err.message}`,
	);
}
if (!restored && !restoreFromLegacyBranch()) {
	console.log("no previous site — starting empty");
}

const metaPath = path.join(site, META_FILE);
let meta = {};
try {
	if (existsSync(metaPath)) meta = JSON.parse(readFileSync(metaPath, "utf8"));
} catch {
	meta = {};
}

// 2 · Add this run's reports ---------------------------------------------
const now = new Date().toISOString();
for (const spec of adds) {
	const [dest, src] = spec.split("=");
	if (!dest || !src || dest.includes("..") || path.isAbsolute(dest)) {
		throw new Error(`invalid --add ${spec}`);
	}
	if (!existsSync(path.join(src, "index.html"))) {
		console.log(`skip ${dest}: no report in ${src}`);
		continue;
	}
	const target = path.join(site, dest);
	rmSync(target, { recursive: true, force: true });
	mkdirSync(path.dirname(target), { recursive: true });
	cpSync(src, target, { recursive: true });
	meta[dest.split("/")[0]] = { updated: now };
	console.log(`added ${dest}`);
}

// 3 · Prune reports of closed PRs ----------------------------------------
const prDirs = readdirSync(site, { withFileTypes: true })
	.filter((d) => d.isDirectory() && /^pr-\d+$/.test(d.name))
	.map((d) => d.name);
let openPrs = null;
try {
	openPrs = new Set(
		gh(
			"--paginate",
			`repos/${repo}/pulls?state=open&per_page=100`,
			"--jq",
			".[].number",
		)
			.split("\n")
			.filter(Boolean),
	);
} catch (err) {
	console.warn(
		`::warning::Could not list open PRs, keeping all: ${err.message}`,
	);
}
const kept = [];
for (const dir of prDirs) {
	const n = dir.slice(3);
	if (openPrs && !openPrs.has(n)) {
		rmSync(path.join(site, dir), { recursive: true, force: true });
		delete meta[dir];
		console.log(`pruned ${dir} (PR #${n} closed)`);
	} else kept.push(n);
}

// 4 · Index -----------------------------------------------------------------
const prMeta = {};
for (const n of kept) {
	let info = {};
	try {
		info = JSON.parse(
			gh(`repos/${repo}/pulls/${n}`, "--jq", "{title, branch: .head.ref}"),
		);
	} catch {
		info = {};
	}
	const updated = meta[`pr-${n}`]?.updated;
	prMeta[n] = { ...info, ...(updated ? { updated } : {}) };
}
writeFileSync(metaPath, JSON.stringify(meta, null, 2));
const prMetaPath = path.join(
	mkdtempSync(path.join(tmpdir(), "pages-")),
	"pr.json",
);
writeFileSync(prMetaPath, JSON.stringify(prMeta));
run(
	process.execPath,
	[
		path.join(import.meta.dirname, "visual-pages-index.mjs"),
		site,
		"--pr-meta",
		prMetaPath,
	],
	{ stdio: "inherit" },
);
