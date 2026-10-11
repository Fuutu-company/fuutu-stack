#!/usr/bin/env node
/**
 * Dependency audit report for CI (and local use).
 *
 * `pnpm outdated` reports versions that CANNOT be installed under the repo's
 * `minimumReleaseAge` policy — publishing the raw list as "updateable" is
 * misleading. This script classifies every outdated package into honest,
 * actionable buckets and prints a markdown report to stdout:
 *
 *   ready  — minor/patch update installable RIGHT NOW: the newest stable,
 *            same-major version old enough for minimumReleaseAge (may be an
 *            intermediate version when `latest` itself is too fresh)
 *   held   — an update exists but every newer version is younger than
 *            minimumReleaseAge. Unlocks automatically, no action needed.
 *   major  — breaking change (major bump, 0.x minor bump, or prerelease
 *            latest) — needs a manual catalog range update + review
 *
 * Exit code is always 0 — the audit is informational, never a gate.
 * Output is empty when nothing is outdated.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REGISTRY = "https://registry.npmjs.org";
const CONCURRENCY = 10;
const DAY_MS = 86_400_000;

/** minimumReleaseAge is configured in minutes in pnpm-workspace.yaml. */
function readMinimumReleaseAge() {
	try {
		const yaml = readFileSync("pnpm-workspace.yaml", "utf8");
		const match = yaml.match(/^minimumReleaseAge:\s*(\d+)/m);
		return match ? Number(match[1]) : 0;
	} catch {
		return 0;
	}
}

// ---------------------------------------------------------------------------
// Version helpers
// ---------------------------------------------------------------------------

function parseVersion(version) {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
	if (!match) return null;
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] ?? null,
	};
}

function compareVersions(a, b) {
	return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/** Same-major (and same-minor for 0.x) non-prerelease bump = non-breaking. */
function isBreaking(current, next) {
	if (next.major > current.major) return true;
	if (current.major === 0 && next.major === 0 && next.minor > current.minor)
		return true;
	return false;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

function getOutdated() {
	try {
		const out = execFileSync("pnpm", ["outdated", "-r", "--format", "json"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		return out.trim() ? JSON.parse(out) : {};
	} catch (error) {
		// pnpm outdated exits non-zero when packages are outdated — the JSON
		// is still on stdout.
		const out = error.stdout?.toString() ?? "";
		try {
			return out.trim() ? JSON.parse(out) : {};
		} catch {
			return {};
		}
	}
}

async function getPublishTimes(name) {
	// Scoped packages: @scope/name → @scope%2Fname (@ stays literal)
	const url = `${REGISTRY}/${name.replace("/", "%2F")}`;
	try {
		const res = await fetch(url, {
			headers: { accept: "application/json" },
		});
		if (!res.ok) return null;
		const data = await res.json();
		return data.time ?? null;
	} catch {
		return null;
	}
}

async function mapWithConcurrency(items, limit, fn) {
	const results = new Array(items.length);
	for (let i = 0; i < items.length; i += limit) {
		const chunk = items.slice(i, i + limit);
		await Promise.all(
			chunk.map(async (item, j) => {
				results[i + j] = await fn(item);
			}),
		);
	}
	return results;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const minAgeMinutes = readMinimumReleaseAge();
const minAgeMs = minAgeMinutes * 60_000;
const minAgeDays = Math.round(minAgeMs / DAY_MS);
const cutoff = Date.now() - minAgeMs;

const outdated = getOutdated();
const entries = Object.entries(outdated);

if (entries.length === 0) {
	process.exit(0);
}

const classified = await mapWithConcurrency(
	entries,
	CONCURRENCY,
	async ([name, info]) => {
		const current = parseVersion(info.current);
		const latest = parseVersion(info.latest);
		if (!current || !latest) {
			return {
				bucket: "major",
				name,
				current: info.current,
				latest: info.latest,
				note: "unparseable version",
			};
		}
		if (isBreaking(current, latest) || latest.prerelease) {
			return {
				bucket: "major",
				name,
				current: info.current,
				latest: info.latest,
			};
		}

		const times = await getPublishTimes(name);
		if (!times) {
			// Registry unreachable — report against latest optimistically.
			return {
				bucket: "held",
				name,
				current: info.current,
				latest: info.latest,
				inDays: "?",
			};
		}

		// Newest stable, non-breaking, age-eligible version > current.
		const eligible = [];
		for (const [version, ts] of Object.entries(times)) {
			const v = parseVersion(version);
			if (!v || v.prerelease || isBreaking(current, v)) continue;
			if (compareVersions(v, current) <= 0) continue;
			const published = Date.parse(ts);
			if (Number.isNaN(published) || published > cutoff) continue;
			eligible.push({ v, version });
		}

		if (eligible.length > 0) {
			eligible.sort((a, b) => compareVersions(a.v, b.v));
			const target = eligible.at(-1).version;
			return {
				bucket: "ready",
				name,
				current: info.current,
				target,
				// True when the installable target is not `latest` — worth saying.
				behind: target !== info.latest ? info.latest : null,
			};
		}

		const latestPublished = Date.parse(times[info.latest] ?? "");
		const inDays = Number.isNaN(latestPublished)
			? "?"
			: Math.max(
					1,
					Math.ceil((latestPublished + minAgeMs - Date.now()) / DAY_MS),
				);
		return {
			bucket: "held",
			name,
			current: info.current,
			latest: info.latest,
			inDays,
		};
	},
);

const ready = classified.filter((c) => c.bucket === "ready");
const held = classified.filter((c) => c.bucket === "held");
const major = classified.filter((c) => c.bucket === "major");

const lines = [];
lines.push("## 📦 Dependency Audit", "");
lines.push(
	`**${entries.length} outdated package(s)** — ${ready.length} ready now, ${held.length} held by the ${minAgeDays}-day release-age policy, ${major.length} major bump(s)`,
	"",
);

if (ready.length > 0) {
	lines.push("### ✅ Ready to update now", "");
	lines.push("| Package | Current | Installable now |", "|---|---|---|");
	for (const p of ready) {
		const note = p.behind ? ` (latest ${p.behind} still <${minAgeDays}d)` : "";
		lines.push(`| \`${p.name}\` | ${p.current} | **${p.target}**${note} |`);
	}
	lines.push(
		"",
		"Bump the catalog floor in `pnpm-workspace.yaml` to the installable version, then `pnpm install`.",
		"",
	);
}

if (held.length > 0) {
	lines.push(`### ⏳ Held by the ${minAgeDays}-day release-age policy`, "");
	lines.push(
		"| Package | Current | Latest | Installable in |",
		"|---|---|---|---|",
	);
	for (const p of held) {
		lines.push(
			`| \`${p.name}\` | ${p.current} | ${p.latest} | ~${p.inDays}d |`,
		);
	}
	lines.push(
		"",
		"Nothing to do — these versions are too new for `minimumReleaseAge` and unlock automatically. They are deliberately **not** counted as actionable.",
		"",
	);
}

if (major.length > 0) {
	lines.push("### ⚠️ Major bumps — manual review", "");
	lines.push("| Package | Current | Latest |", "|---|---|---|");
	for (const p of major) {
		lines.push(`| \`${p.name}\` | ${p.current} | ${p.latest} |`);
	}
	lines.push(
		"",
		"Breaking changes — review the changelog and bump the catalog range in `pnpm-workspace.yaml` deliberately.",
		"",
	);
}

lines.push(
	`> Info only — the pipeline did **not** fail. \`minimumReleaseAge: ${minAgeMinutes}\` (pnpm-workspace.yaml) blocks versions younger than ${minAgeDays} days, so \`pnpm outdated\`'s "latest" and what you can actually install differ. This report always shows the installable version.`,
);

process.stdout.write(`${lines.join("\n")}\n`);
