#!/usr/bin/env node
// Regenerate the gh-pages index tree after a visual-report deploy:
//   <root>/index.html          — pinned develop/main cards ("latest"),
//                                then pr-<N> cards, newest first
//   <root>/<dir>/index.html    — per-dir landing page listing its app reports
// A "report dir" (pr-<N>/, develop/, main/, …) holds one subdir per app,
// each a self-contained visual-report (index.html + images/). Dirs without
// any app report are skipped. Rerunning regenerates cleanly.
// Usage: node tooling/scripts/visual-pages-index.mjs <gh-pages-worktree>

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root || !existsSync(root)) {
	console.error("Usage: visual-pages-index.mjs <gh-pages-worktree>");
	process.exit(2);
}

const esc = (s) =>
	String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

// "Visual Reports — <repo>": GITHUB_REPOSITORY in CI, repo dir name locally.
const repo =
	process.env.GITHUB_REPOSITORY?.split("/").pop() ??
	(() => {
		try {
			return path.basename(
				execFileSync("git", ["rev-parse", "--show-toplevel"], {
					encoding: "utf8",
				}).trim(),
			);
		} catch {
			return "repository";
		}
	})();

const APP_NAMES = { saas: "SaaS", marketing: "Marketing" };
const appName = (d) => APP_NAMES[d] ?? d;

// App subdirs = dirs that contain a report index.html. Anything else
// (images/, stray files) is ignored.
const appDirs = (dir) =>
	existsSync(path.join(root, dir))
		? readdirSync(path.join(root, dir), { withFileTypes: true })
				.filter(
					(e) =>
						e.isDirectory() &&
						existsSync(path.join(root, dir, e.name, "index.html")),
				)
				.map((e) => e.name)
				.sort()
		: [];

const topDirs = readdirSync(root, { withFileTypes: true })
	.filter((e) => e.isDirectory())
	.map((e) => e.name);

// Pinned branches always lead the index, in this order.
const PINNED = ["develop", "main"];
const pinned = PINNED.map((d) => ({ dir: d, apps: appDirs(d) })).filter(
	(p) => p.apps.length > 0,
);
const prs = topDirs
	.filter((d) => /^pr-\d+$/.test(d))
	.map((d) => ({ dir: d, n: Number(d.slice(3)), apps: appDirs(d) }))
	.filter((p) => p.apps.length > 0)
	.sort((a, b) => b.n - a.n);

const STYLE = `
:root{color-scheme:dark}
*{box-sizing:border-box;margin:0}
body{background:#0a0a0b;color:#e4e4e7;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:2rem;max-width:1400px;margin:auto}
h1{font-size:1.5rem}h2{font-size:1.05rem;font-weight:600}
.top{position:sticky;top:0;z-index:10;display:flex;align-items:baseline;gap:1.25rem;margin:0 -2rem 1.5rem;padding:.75rem 2rem;background:rgba(10,10,11,.94);border-bottom:1px solid #27272a;backdrop-filter:blur(8px)}
.top h1{font-size:1.15rem}
.top a{color:#a1a1aa;text-decoration:none;font-size:.85rem}
.top a:hover{color:#e4e4e7;text-decoration:underline}
.meta{color:#a1a1aa;margin:.5rem 0 1.5rem}
.section{font-size:1.15rem;font-weight:700;margin:1.5rem 0 1rem}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
.card{display:block;background:#111113;border:1px solid #27272a;border-radius:.75rem;padding:1.25rem;color:inherit;text-decoration:none}
.card:hover{border-color:#52525b}
.card h2{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.badge{color:#0a0a0b;background:#22c55e;border-radius:.375rem;padding:.1rem .55rem;font-size:.75rem;font-weight:600}
.apps{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.75rem}
.chip{background:#18181b;border:1px solid #27272a;border-radius:999px;padding:.15rem .7rem;font-size:.8rem;color:#d4d4d8}
.dir{color:#71717a;font-size:.8rem;font-family:ui-monospace,Menlo,monospace;margin-top:.4rem}
`;

const page = (title, header, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head><body>
<nav class="top">${header}</nav>
${body}
</body></html>`;

const chips = (apps) =>
	`<div class="apps">${apps.map((a) => `<span class="chip">${esc(a)}</span>`).join("")}</div>`;

// Per-dir landing page: one card per app report ("Choose app: …").
const writeLanding = (dir) => {
	const apps = appDirs(dir);
	if (apps.length === 0) return false;
	const cards = apps
		.map(
			(a) =>
				`<a class="card" href="${esc(a)}/"><h2>${esc(appName(a))}</h2><p class="dir">${esc(dir)}/${esc(a)}/</p></a>`,
		)
		.join("\n");
	writeFileSync(
		path.join(root, dir, "index.html"),
		page(
			`${dir} — visual reports`,
			`<a href="../">← All reports</a><h1>${esc(dir)} — visual reports</h1>`,
			`<p class="meta">Choose app:</p>\n<div class="grid">${cards}</div>`,
		),
	);
	return true;
};

// Landings for every dir that holds app reports — keeps the app reports'
// "../" back-nav working even for dirs the root index doesn't list.
let landings = 0;
for (const d of topDirs) if (writeLanding(d)) landings++;

const pinnedCards = pinned
	.map(
		(p) =>
			`<a class="card" href="${esc(p.dir)}/"><h2>${esc(p.dir)} <span class="badge">latest</span></h2>${chips(p.apps)}</a>`,
	)
	.join("\n");
const prCards = prs
	.map(
		(p) =>
			`<a class="card" href="${esc(p.dir)}/"><h2>PR #${p.n}</h2>${chips(p.apps)}</a>`,
	)
	.join("\n");

// No timestamp in the output — deterministic bytes let the two e2e matrix
// legs' index commits converge (identical tree → rebase drops the empty
// replay) instead of conflicting on every concurrent deploy.
const body = `${pinnedCards ? `<h2 class="section">Latest</h2>\n<div class="grid">${pinnedCards}</div>` : ""}
${prCards ? `<h2 class="section">Pull requests</h2>\n<div class="grid">${prCards}</div>` : ""}
${!pinnedCards && !prCards ? `<p class="meta">No visual reports published yet.</p>` : ""}`;

writeFileSync(
	path.join(root, "index.html"),
	page(
		`Visual Reports — ${repo}`,
		`<h1>Visual Reports — ${esc(repo)}</h1>`,
		body,
	),
);

console.log(
	`Pages index → ${root}/index.html (${pinned.length} pinned, ${prs.length} PRs, ${landings} landing pages)`,
);
