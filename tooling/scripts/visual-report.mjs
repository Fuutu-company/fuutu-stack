#!/usr/bin/env node
// Build a self-contained visual-diff HTML report from .fuutu/visual-baselines/<app>/.
// "expected" = baseline committed in HEAD (git show), "actual" = the PNG on disk.
// Usage: node tooling/scripts/visual-report.mjs --app <saas|marketing> [--out <dir>] [--threshold 0.02]

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const app = arg("app");
if (!app) {
	console.error(
		"Usage: visual-report.mjs --app <saas|marketing> [--out <dir>] [--threshold 0.02]",
	);
	process.exit(2);
}
const threshold = Number.parseFloat(arg("threshold", "0.02"));
const outDir = arg("out", `apps/${app}/visual-report`);
const imagesDir = path.join(outDir, "images");

const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], {
	encoding: "utf8",
}).trim();
const baselineDir = `.fuutu/visual-baselines/${app}`;
const baselineAbs = path.join(repoRoot, baselineDir);
if (!existsSync(baselineAbs)) {
	console.error(`Baseline dir not found: ${baselineDir}`);
	process.exit(2);
}

const git = (gitArgs) =>
	execFileSync("git", gitArgs, { cwd: repoRoot, encoding: "utf8" }).trim();
const gitShow = (file) => {
	try {
		return execFileSync("git", ["show", `HEAD:${file}`], { cwd: repoRoot });
	} catch {
		return null; // not tracked in HEAD → newly added baseline
	}
};

// --- working-tree status: which baselines the test run rewrote ----------------
const statusByFile = new Map();
for (const line of git(["status", "--porcelain", "--", baselineDir]).split(
	"\n",
)) {
	if (!line.trim()) continue;
	statusByFile.set(line.slice(3).trim(), line.slice(0, 2));
}

// Known Playwright projects/viewports/locales — filename parsing is best-effort;
// the raw filename is always shown, so a parse miss only loses the pretty title.
const PROJECTS = new Set([
	"mobile-safari",
	"mobile-chrome",
	"desktop-chrome",
	"desktop-firefox",
	"desktop-safari",
	"desktop-edge",
	"chromium",
	"firefox",
	"webkit",
	"msedge",
]);
const VIEWPORTS = new Set(["desktop", "mobile", "tablet"]);
const LOCALES = new Set(["en", "de"]);
const PLATFORMS = new Set(["linux", "darwin", "win32"]);

function parseFilename(file) {
	const tokens = file.replace(/\.png$/, "").split("-");
	const meta = {
		page: file.replace(/\.png$/, ""),
		locale: null,
		viewport: null,
		project: null,
	};
	if (tokens.length && PLATFORMS.has(tokens[tokens.length - 1])) tokens.pop();
	const two = tokens.slice(-2).join("-");
	if (PROJECTS.has(two)) {
		meta.project = two;
		tokens.splice(-2);
	} else if (tokens.length && PROJECTS.has(tokens[tokens.length - 1])) {
		meta.project = tokens.pop();
	}
	if (tokens.length && VIEWPORTS.has(tokens[tokens.length - 1])) {
		meta.viewport = tokens.pop();
		if (tokens.length && LOCALES.has(tokens[tokens.length - 1]))
			meta.locale = tokens.pop();
	}
	if (tokens.length) meta.page = tokens.join("-");
	return meta;
}

const esc = (s) =>
	String(s)
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

mkdirSync(imagesDir, { recursive: true });

// Union of PNGs on disk and PNGs deleted from disk (still tracked in HEAD).
const onDisk = new Set(
	readdirSync(baselineAbs).filter((f) => f.endsWith(".png")),
);
const files = new Set(onDisk);
for (const [file, code] of statusByFile) {
	const name = path.basename(file);
	if (name.endsWith(".png") && code.includes("D")) files.add(name);
}

const results = [];
for (const file of [...files].sort()) {
	const rel = `${baselineDir}/${file}`;
	const code = statusByFile.get(rel) ?? "";
	const actual = onDisk.has(file)
		? readFileSync(path.join(baselineAbs, file))
		: null;
	const expected = gitShow(rel);
	const meta = parseFilename(file);
	const stem = file.replace(/\.png$/, "");
	const entry = {
		file,
		...meta,
		status: "unchanged",
		diffPx: null,
		diffRatio: null,
	};

	const writeImg = (suffix, buf) => {
		const name = `${stem}-${suffix}.png`;
		writeFileSync(path.join(imagesDir, name), buf);
		return `images/${name}`;
	};

	if (!expected) {
		entry.status = "added"; // untracked (??) or staged (A) — no baseline in HEAD
		if (actual) entry.actualImg = writeImg("actual", actual);
	} else if (!actual) {
		entry.status = "removed";
		entry.expectedImg = writeImg("expected", expected);
	} else if (
		code.includes("M") ||
		code.includes("R") ||
		!expected.equals(actual)
	) {
		entry.status = "changed";
		entry.expectedImg = writeImg("expected", expected);
		entry.actualImg = writeImg("actual", actual);
		try {
			const expPng = PNG.sync.read(expected);
			const actPng = PNG.sync.read(actual);
			if (expPng.width === actPng.width && expPng.height === actPng.height) {
				const diff = new PNG({ width: expPng.width, height: expPng.height });
				entry.diffPx = pixelmatch(
					expPng.data,
					actPng.data,
					diff.data,
					expPng.width,
					expPng.height,
					{
						threshold: 0.1,
					},
				);
				entry.diffRatio = entry.diffPx / (expPng.width * expPng.height);
				entry.diffImg = writeImg("diff", PNG.sync.write(diff));
			} else {
				entry.dimensionMismatch = `${expPng.width}x${expPng.height} → ${actPng.width}x${actPng.height}`;
			}
		} catch {
			entry.dimensionMismatch = "PNG decode failed";
		}
	} else {
		// Unchanged — still emit both for side-by-side display.
		entry.expectedImg = writeImg("expected", expected);
		entry.actualImg = writeImg("actual", actual);
	}
	if (entry.diffRatio !== null)
		entry.withinTolerance = entry.diffRatio <= threshold;
	results.push(entry);
}

const count = (s) => results.filter((r) => r.status === s).length;
const summary = {
	app,
	branch:
		process.env.GITHUB_REF_NAME || git(["rev-parse", "--abbrev-ref", "HEAD"]),
	pr: process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER || readPrNumber(),
	sha: git(["rev-parse", "--short", "HEAD"]),
	generatedAt: new Date().toISOString(),
	threshold,
	total: results.length,
	changed: count("changed"),
	added: count("added"),
	removed: count("removed"),
	unchanged: count("unchanged"),
	files: results.map(({ expectedImg, actualImg, diffImg, ...rest }) => rest),
};

function readPrNumber() {
	try {
		if (
			process.env.GITHUB_EVENT_PATH &&
			existsSync(process.env.GITHUB_EVENT_PATH)
		) {
			return (
				JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"))
					.pull_request?.number ?? null
			);
		}
	} catch {}
	return null;
}

writeFileSync(
	path.join(outDir, "summary.json"),
	`${JSON.stringify(summary, null, 2)}\n`,
);

const BADGES = {
	changed: ["changed", "#f59e0b"],
	added: ["added", "#22c55e"],
	removed: ["removed", "#ef4444"],
	unchanged: ["unchanged", "#71717a"],
};
const order = { changed: 0, added: 1, removed: 2, unchanged: 3 };
results.sort(
	(a, b) => order[a.status] - order[b.status] || a.file.localeCompare(b.file),
);

const img = (src, label) =>
	src
		? `<figure><figcaption>${label}</figcaption><img src="${esc(src)}" alt="${label}" loading="lazy"></figure>`
		: "";

// Filter dimensions, built from whatever the filenames actually encode.
const projects = [
	...new Set(results.map((r) => r.project).filter(Boolean)),
].sort();
const viewports = [
	...new Set(results.map((r) => r.viewport).filter(Boolean)),
].sort();
const statuses = Object.keys(order).filter((s) => count(s) > 0);

const options = (values) =>
	values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");

const cards = results
	.map((r) => {
		const [label, color] = BADGES[r.status];
		const chips = [
			["browser", r.project],
			["device", r.viewport],
			["locale", r.locale],
		]
			.filter(([, v]) => v)
			.map(
				([k, v]) =>
					`<span class="chip"><span class="k">${k}</span>${esc(v)}</span>`,
			)
			.join("");
		const note =
			r.diffRatio !== null
				? `<p class="note">${r.diffPx.toLocaleString("en")} px differ (${(r.diffRatio * 100).toFixed(2)}%)${r.withinTolerance ? " — within tolerance" : ""}</p>`
				: r.dimensionMismatch
					? `<p class="note warn">${esc(r.dimensionMismatch)} — no pixel diff</p>`
					: "";
		return `<section class="card" data-status="${r.status}" data-project="${esc(r.project ?? "")}" data-viewport="${esc(r.viewport ?? "")}" data-locale="${esc(r.locale ?? "")}" data-search="${esc(`${r.page} ${r.file}`.toLowerCase())}">
  <header><h2>${esc(r.page)}</h2>${chips}<span class="badge" style="background:${color}">${label}</span></header>
  <p class="file">${esc(r.file)}</p>
  ${note}
  <div class="imgs">${img(r.expectedImg, "expected")}${img(r.actualImg, r.status === "added" ? "actual (new)" : "actual")}${img(r.diffImg, "diff")}</div>
</section>`;
	})
	.join("\n");

const statusColors = JSON.stringify(
	Object.fromEntries(
		Object.entries(BADGES).map(([status, [, color]]) => [status, color]),
	),
);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Visual report — ${esc(app)}</title><style>
:root{color-scheme:dark}
*{box-sizing:border-box;margin:0}
body{background:#0a0a0b;color:#e4e4e7;font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;padding:2rem;max-width:1400px;margin:auto}
h1{font-size:1.5rem}h2{font-size:1.05rem;font-weight:600}
.meta{color:#a1a1aa;margin:.5rem 0 1.5rem}.meta code{color:#e4e4e7}
.filters{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin:0 -2rem 1.5rem;padding:.75rem 2rem;background:rgba(10,10,11,.94);border-bottom:1px solid #27272a;backdrop-filter:blur(8px)}
.filters label{display:flex;align-items:center;gap:.4rem;color:#a1a1aa;font-size:.85rem}
.filters select,.filters input{background:#18181b;border:1px solid #27272a;border-radius:.5rem;color:#e4e4e7;font:inherit;padding:.35rem .6rem}
.filters input{min-width:11rem}
.filters select:focus,.filters input:focus{outline:1px solid #52525b}
.counts{display:flex;gap:.5rem;flex-wrap:wrap;margin-left:auto}
.chips{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:2rem}
.chips .chip,.chip{background:#18181b;border:1px solid #27272a;border-radius:999px;padding:.15rem .7rem;font-size:.8rem;color:#d4d4d8}
.chip .k{color:#71717a;margin-right:.35rem}
.card{background:#111113;border:1px solid #27272a;border-radius:.75rem;padding:1.25rem;margin-bottom:1.25rem}
.card[hidden]{display:none}
.card header{display:flex;align-items:center;gap:.6rem;flex-wrap:wrap}
.badge{color:#0a0a0b;border-radius:.375rem;padding:.1rem .55rem;font-size:.75rem;font-weight:600;margin-left:auto}
.file{color:#71717a;font-size:.8rem;font-family:ui-monospace,Menlo,monospace;margin:.35rem 0}
.note{color:#fbbf24;font-size:.85rem;margin:.4rem 0}
.note.warn{color:#f87171}
.imgs{display:flex;gap:1rem;flex-wrap:wrap;margin-top:.75rem}
figure{flex:1 1 280px;min-width:0}
figcaption{color:#a1a1aa;font-size:.8rem;margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.05em}
img{width:100%;border:1px solid #27272a;border-radius:.5rem;background:#000;image-rendering:auto}
</style></head><body>
<h1>Visual diff report — ${esc(app)}</h1>
<p class="meta">branch <code>${esc(summary.branch)}</code>${summary.pr ? ` · PR <code>#${esc(summary.pr)}</code>` : ""} · commit <code>${esc(summary.sha)}</code> · ${esc(summary.generatedAt)} · ${(threshold * 100).toFixed(0)}% pixel tolerance</p>
<nav class="filters">
<label>Browser <select id="f-project"><option value="">all</option>${options(projects)}</select></label>
${viewports.length ? `<label>Device <select id="f-viewport"><option value="">all</option>${options(viewports)}</select></label>` : ""}
<label>Status <select id="f-status"><option value="">all</option>${options(statuses)}</select></label>
<input id="f-search" type="search" placeholder="Search pages…" autocomplete="off">
<span class="counts" id="counts"></span>
</nav>
<div class="chips">
<span class="chip">${summary.total} pages</span>
<span class="chip" style="color:#f59e0b">${summary.changed} changed</span>
<span class="chip" style="color:#22c55e">${summary.added} added</span>
${summary.removed ? `<span class="chip" style="color:#ef4444">${summary.removed} removed</span>` : ""}
<span class="chip">${summary.unchanged} unchanged</span>
</div>
${cards}
<script>
const COLORS=${statusColors};
const cards=[...document.querySelectorAll(".card")];
const countsEl=document.getElementById("counts");
const els={project:document.getElementById("f-project"),viewport:document.getElementById("f-viewport"),status:document.getElementById("f-status"),search:document.getElementById("f-search")};
function apply(){
const p=els.project.value,v=els.viewport?els.viewport.value:"",s=els.status.value,q=els.search.value.trim().toLowerCase();
const tally={};let shown=0;
for(const c of cards){
const ok=(!p||c.dataset.project===p)&&(!v||c.dataset.viewport===v)&&(!s||c.dataset.status===s)&&(!q||c.dataset.search.includes(q));
c.hidden=!ok;
if(ok){shown++;tally[c.dataset.status]=(tally[c.dataset.status]||0)+1;}
}
countsEl.innerHTML='<span class="chip">'+shown+" shown</span>"+Object.keys(tally).sort().map(st=>'<span class="chip" style="color:'+(COLORS[st]||"#d4d4d8")+'">'+st+" ("+tally[st]+")</span>").join("");
}
for(const el of Object.values(els))if(el)el.addEventListener("input",apply);
apply();
</script>
</body></html>`;

writeFileSync(path.join(outDir, "index.html"), html);
console.log(
	`Visual report → ${outDir}/index.html (${summary.total} pages: ${summary.changed} changed, ${summary.added} added, ${summary.removed} removed, ${summary.unchanged} unchanged)`,
);
