#!/usr/bin/env node
/**
 * Licences of everything the desktop app ships — the licence gate and the
 * third-party notices of the About window.
 *
 *   node scripts/licenses.mjs check     # fail on a licence outside the allowlist
 *   node scripts/licenses.mjs notices   # write out/third-party-notices.json
 *
 * Run after `next build` (needs `out/` with source maps — `build:desktop`
 * strips the maps afterwards). npm: exactly the packages whose code is in
 * the static export (read from the source maps, not the dependency tree —
 * build tools such as Next's sharp never reach the app). Rust: the normal
 * (non-dev, non-build) dependency graph of the release build with default
 * features (`cargo metadata`); cargo-deny gates the same graph in CI.
 * Sidecars: the programs your app bundles (`shippedSidecars()` in the
 * app-owned scripts/lib/app-sidecars.mjs) — notices and the same allowlist
 * as npm.
 */
import { spawnSync } from "node:child_process";
import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { shippedSidecars } from "./lib/app-sidecars.mjs";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(appDir, "../..");
const outDir = join(appDir, "out");
const tauriDir = join(appDir, "src-tauri");

/** Licences that allow closed-source commercial distribution (ADR-002 #13). */
export const ALLOWED_LICENSES = new Set([
	"MIT",
	"Apache-2.0",
	"BSD-2-Clause",
	"BSD-3-Clause",
	"ISC",
	"Zlib",
	"MPL-2.0",
	"CC0-1.0",
	"Unlicense",
	"Unicode-3.0",
	"Unicode-DFS-2016",
	"0BSD",
]);

/**
 * True when an SPDX expression is satisfiable with allowed licences:
 * `A OR B` needs one side, `A AND B` both, `A WITH exception` needs A.
 */
export function isAllowedExpression(expression) {
	if (!expression) return false;
	const expr = expression.trim().replace(/^\((.*)\)$/, "$1");
	const or = splitTop(expr, " OR ");
	if (or.length > 1) return or.some(isAllowedExpression);
	const and = splitTop(expr, " AND ");
	if (and.length > 1) return and.every(isAllowedExpression);
	const base = expr.split(" WITH ")[0].trim();
	return ALLOWED_LICENSES.has(base.replace(/\+$/, ""));
}

function splitTop(expr, separator) {
	const parts = [];
	let depth = 0;
	let start = 0;
	const upper = expr.toUpperCase();
	for (let i = 0; i < expr.length; i++) {
		if (expr[i] === "(") depth++;
		else if (expr[i] === ")") depth--;
		else if (depth === 0 && upper.startsWith(separator, i)) {
			parts.push(expr.slice(start, i));
			start = i + separator.length;
			i += separator.length - 1;
		}
	}
	parts.push(expr.slice(start));
	return parts.map((part) => part.trim()).filter(Boolean);
}

/** `.../node_modules/.pnpm/x@1/node_modules/@scope/name/dist/a.js` → package dir. */
export function packageDirFromSource(source) {
	const path = decodeURIComponent(
		source.replace(/^[a-z]+:\/\/\/?(\[project\]\/)?/, ""),
	);
	const marker = "node_modules/";
	const at = path.lastIndexOf(marker);
	if (at === -1) return null;
	const rest = path.slice(at + marker.length).split("/");
	const name = rest[0]?.startsWith("@") ? `${rest[0]}/${rest[1]}` : rest[0];
	if (!name || name.startsWith(".")) return null;
	return `${path.slice(0, at + marker.length)}${name}`;
}

function licenseText(dir) {
	try {
		const file = readdirSync(dir).find((entry) =>
			/^(licen[cs]e|copying|notice)(\.|-|$)/i.test(entry),
		);
		return file ? readFileSync(join(dir, file), "utf8").trim() : null;
	} catch {
		return null;
	}
}

function walk(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) walk(full, found);
		else if (entry.endsWith(".map")) found.push(full);
	}
	return found;
}

/** npm packages whose code is in the static export. */
export function shippedNpmPackages() {
	if (!existsSync(outDir)) throw new Error("no out/ — run `next build` first");
	const maps = walk(outDir);
	if (maps.length === 0) {
		throw new Error(
			"out/ has no source maps — build with productionBrowserSourceMaps",
		);
	}
	const dirs = new Set();
	for (const map of maps) {
		const { sources = [] } = JSON.parse(readFileSync(map, "utf8"));
		for (const source of sources) {
			const rel = packageDirFromSource(source);
			if (rel) dirs.add(rel);
		}
	}
	const packages = new Map();
	for (const rel of dirs) {
		const candidates = [join(repoRoot, rel), join(appDir, rel), rel];
		const dir = candidates.find((c) => existsSync(join(c, "package.json")));
		if (!dir) continue;
		const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
		if (pkg.private || pkg.name?.startsWith("@fuutu/")) continue; // our own code
		const key = `${pkg.name}@${pkg.version}`;
		if (packages.has(key)) continue;
		packages.set(key, {
			ecosystem: "npm",
			name: pkg.name,
			version: pkg.version,
			license:
				typeof pkg.license === "string"
					? pkg.license
					: (pkg.license?.type ?? null),
			repository:
				typeof pkg.repository === "string"
					? pkg.repository
					: (pkg.repository?.url ?? null),
			text: licenseText(realpathSync(dir)),
		});
	}
	return [...packages.values()];
}

/** Rust crates linked into a release build (normal deps, default features). */
export function shippedCrates() {
	const result = spawnSync(
		"cargo",
		["metadata", "--format-version", "1", "--locked"],
		{
			cwd: tauriDir,
			encoding: "utf8",
			maxBuffer: 256 * 1024 * 1024,
		},
	);
	if (result.status !== 0)
		throw new Error(`cargo metadata failed:\n${result.stderr}`);
	const meta = JSON.parse(result.stdout);
	const byId = new Map(meta.packages.map((p) => [p.id, p]));
	const nodes = new Map(meta.resolve.nodes.map((n) => [n.id, n]));
	const rootId =
		meta.resolve.root ??
		meta.packages.find((p) => p.name === "desktop-app")?.id;
	const seen = new Set();
	const queue = [rootId];
	while (queue.length) {
		const id = queue.pop();
		if (seen.has(id)) continue;
		seen.add(id);
		for (const dep of nodes.get(id)?.deps ?? []) {
			const normal = dep.dep_kinds.some((k) => k.kind === null);
			// Optional deps behind non-default features (the devtools bridge)
			// are absent from the release build.
			if (
				normal &&
				!(id === rootId && dep.name === "tauri_plugin_mcp_bridge")
			) {
				queue.push(dep.pkg);
			}
		}
	}
	seen.delete(rootId);
	return [...seen]
		.map((id) => byId.get(id))
		.filter((pkg) => pkg?.source) // registry crates only (no path crates of ours)
		.map((pkg) => ({
			ecosystem: "cargo",
			name: pkg.name,
			version: pkg.version,
			license: pkg.license ?? null,
			repository: pkg.repository ?? null,
			text: licenseText(dirname(pkg.manifest_path)),
		}));
}

/**
 * Notice entries for bundled sidecar programs. Every entry needs `name`,
 * `version`, `license` and `text` — a sidecar without its licence text
 * cannot ship.
 */
export function sidecarPackages(entries) {
	return entries.map((entry, index) => {
		for (const field of ["name", "version", "license", "text"]) {
			if (typeof entry?.[field] !== "string" || !entry[field].trim()) {
				throw new Error(
					`app-sidecars.mjs: shippedSidecars()[${index}] (${entry?.name ?? "unnamed"}) needs a "${field}"`,
				);
			}
		}
		return {
			ecosystem: "sidecar",
			name: entry.name,
			version: entry.version,
			license: entry.license,
			repository: entry.repository ?? null,
			text: entry.text,
		};
	});
}

/** Packages whose licence is outside the allowlist. */
export function licenseViolations(packages) {
	return packages.filter((p) => !isAllowedExpression(p.license));
}

function main() {
	const [command] = process.argv.slice(2);
	const npm = shippedNpmPackages();
	const sidecars = sidecarPackages(shippedSidecars());
	const all = [...npm, ...sidecars, ...shippedCrates()].sort((a, b) =>
		`${a.ecosystem}:${a.name}`.localeCompare(`${b.ecosystem}:${b.name}`),
	);
	if (command === "check") {
		// cargo-deny gates Rust (deny.toml) — this gate covers npm + sidecars.
		const bad = licenseViolations([...npm, ...sidecars]);
		for (const p of bad)
			console.error(
				`✗ ${p.ecosystem} ${p.name}@${p.version}: ${p.license ?? "no licence"}`,
			);
		console.log(
			`${npm.length} shipped npm packages and ${sidecars.length} sidecars checked, ${bad.length} not allowed`,
		);
		process.exit(bad.length ? 1 : 0);
	}
	if (command === "notices") {
		const file = join(outDir, "third-party-notices.json");
		writeFileSync(
			file,
			JSON.stringify({ generatedAt: new Date().toISOString(), packages: all }),
		);
		console.log(`notices: ${all.length} packages → ${file}`);
		return;
	}
	console.error("usage: licenses.mjs <check|notices>");
	process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
