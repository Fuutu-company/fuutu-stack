#!/usr/bin/env node
// Regenerate the gh-pages index tree after a visual-report deploy:
//   <root>/index.html          — pinned develop/main rows ("latest"),
//                                then pr-<N> rows, newest first
//   <root>/<dir>/index.html    — per-dir landing page listing its app reports
// A "report dir" (pr-<N>/, develop/, main/, …) holds one subdir per app,
// each a self-contained visual-report (index.html + images/). Dirs without
// any app report are skipped. Rerunning regenerates cleanly.
// Usage: node tooling/scripts/visual-pages-index.mjs <gh-pages-worktree> [--pr-meta <file>]
// --pr-meta: JSON { "<N>": { "title": "…", "branch": "…", "updated": "<ISO>" } }
//            CI fills it via `gh api` (title + head branch) and `git log`
//            (last-commit time for the pr-<N> dir). Missing/partial entries
//            fall back to "PR #N" with no timestamp.

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
let root;
let prMetaPath;
for (let i = 0; i < argv.length; i++) {
	if (argv[i] === "--pr-meta") prMetaPath = argv[++i];
	else if (!root) root = argv[i];
}
if (!root || !existsSync(root)) {
	console.error(
		"Usage: visual-pages-index.mjs <gh-pages-worktree> [--pr-meta <file>]",
	);
	process.exit(2);
}

// PR metadata keyed by PR number — best-effort, every field optional.
let prMeta = {};
if (prMetaPath && existsSync(prMetaPath)) {
	try {
		prMeta = JSON.parse(readFileSync(prMetaPath, "utf8"));
	} catch {
		console.warn(`Could not parse --pr-meta ${prMetaPath} — ignoring`);
	}
}

const esc = (s) =>
	String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

// Repo slug for GitHub PR links; GITHUB_REPOSITORY in CI, kit repo otherwise.
const repoSlug = process.env.GITHUB_REPOSITORY ?? "Fuutu-company/fuutu-stack";
const prUrl = (n) => `https://github.com/${repoSlug}/pull/${n}`;

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

// "2026-10-30T13:02:11+00:00" → "2026-10-30 13:02 UTC"; null when unparseable.
const fmtTime = (iso) => {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return null;
	const p = (v) => String(v).padStart(2, "0");
	return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
};

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
/* Root index: table-like list — one row per report dir. */
.list{border:1px solid #27272a;border-radius:.75rem;overflow:hidden}
.row{display:grid;grid-template-columns:9.5rem minmax(0,1fr) auto 11rem;gap:1rem;align-items:center;padding:.85rem 1.25rem;background:#111113;border-bottom:1px solid #27272a}
.row:last-child{border-bottom:0}
.row:hover{background:#17171a}
.cell{min-width:0;color:inherit;text-decoration:none}
.ref{font-weight:600;display:flex;align-items:center;gap:.5rem}
a.ref{color:#e4e4e7}
a.ref:hover{text-decoration:underline}
a.pr-link{color:#a1a1aa}
a.pr-link:hover{color:#e4e4e7;text-decoration:underline}
.ext{font-size:.75em;color:#71717a}
.desc{display:flex;flex-direction:column;gap:.1rem}
a.desc:hover .title{text-decoration:underline}
.title{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.branch{color:#71717a;font-size:.8rem;font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.apps{display:flex;gap:.4rem;flex-wrap:wrap;justify-content:flex-end}
a.chip{background:#18181b;border:1px solid #27272a;border-radius:999px;padding:.15rem .7rem;font-size:.8rem;color:#d4d4d8;text-decoration:none}
a.chip:hover{border-color:#52525b;color:#e4e4e7}
.time{color:#71717a;font-size:.8rem;text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
@media (max-width:760px){.row{grid-template-columns:1fr;gap:.5rem}.apps{justify-content:flex-start}.time{text-align:left}}
/* Landing pages: one card per app report. */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}
.card{display:block;background:#111113;border:1px solid #27272a;border-radius:.75rem;padding:1.25rem;color:inherit;text-decoration:none}
.card:hover{border-color:#52525b}
.card h2{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.badge{color:#0a0a0b;background:#22c55e;border-radius:.375rem;padding:.1rem .55rem;font-size:.75rem;font-weight:600}
.dir{color:#71717a;font-size:.8rem;font-family:ui-monospace,Menlo,monospace;margin-top:.4rem}
`;

const page = (title, header, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head><body>
<nav class="top">${header}</nav>
${body}
</body></html>`;

// App badges on the root index link straight into <dir>/<app>/.
const appLinks = (dir, apps) =>
	`<span class="apps">${apps.map((a) => `<a class="chip" href="${esc(dir)}/${esc(a)}/">${esc(appName(a))}</a>`).join("")}</span>`;

// Per-dir landing page: one card per app report ("Choose app: …").
// pr-<N> dirs get a GitHub PR link in the header (new tab).
const writeLanding = (dir) => {
	const apps = appDirs(dir);
	if (apps.length === 0) return false;
	const cards = apps
		.map(
			(a) =>
				`<a class="card" href="${esc(a)}/"><h2>${esc(appName(a))}</h2><p class="dir">${esc(dir)}/${esc(a)}/</p></a>`,
		)
		.join("\n");
	const prN = /^pr-(\d+)$/.exec(dir)?.[1];
	const ghLink = prN
		? `<a href="${esc(prUrl(prN))}" target="_blank" rel="noopener">PR #${esc(prN)} <span class="ext">↗</span></a>`
		: "";
	writeFileSync(
		path.join(root, dir, "index.html"),
		page(
			`${dir} — visual reports`,
			`<a href="../">← All reports</a><h1>${esc(dir)} — visual reports</h1>${ghLink}`,
			`<p class="meta">Choose app:</p>\n<div class="grid">${cards}</div>`,
		),
	);
	return true;
};

// Landings for every dir that holds app reports — keeps the app reports'
// "../" back-nav working even for dirs the root index doesn't list.
let landings = 0;
for (const d of topDirs) if (writeLanding(d)) landings++;

// Pinned rows lead the list ("latest"); PR rows carry title + head branch
// from --pr-meta and link the PR number out to GitHub in a new tab.
const pinnedRows = pinned
	.map(
		(p) => `<div class="row">
<a class="cell ref" href="${esc(p.dir)}/">${esc(p.dir)} <span class="badge">latest</span></a>
<span class="cell desc"></span>
${appLinks(p.dir, p.apps)}
<span class="cell time">—</span>
</div>`,
	)
	.join("\n");

const prRows = prs
	.map((p) => {
		const meta = prMeta[String(p.n)] ?? {};
		const title =
			typeof meta.title === "string" && meta.title.trim()
				? meta.title
				: `PR #${p.n}`;
		const branch =
			typeof meta.branch === "string" && meta.branch.trim()
				? `<span class="branch">${esc(meta.branch)}</span>`
				: "";
		const updated = meta.updated ? fmtTime(meta.updated) : null;
		return `<div class="row">
<a class="cell ref pr-link" href="${esc(prUrl(p.n))}" target="_blank" rel="noopener">PR #${p.n} <span class="ext">↗</span></a>
<a class="cell desc" href="${esc(p.dir)}/"><span class="title">${esc(title)}</span>${branch}</a>
${appLinks(p.dir, p.apps)}
<span class="cell time">${updated ? esc(updated) : "—"}</span>
</div>`;
	})
	.join("\n");

// Timestamps come from git log on gh-pages (via --pr-meta), so index bytes
// now track history — the workflow regenerates the index inside its
// rebase-retry loop so the last writer always renders the latest state.
const body = `${pinnedRows ? `<h2 class="section">Latest</h2>\n<div class="list">${pinnedRows}</div>` : ""}
${prRows ? `<h2 class="section">Pull requests</h2>\n<div class="list">${prRows}</div>` : ""}
${!pinnedRows && !prRows ? `<p class="meta">No visual reports published yet.</p>` : ""}`;

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
