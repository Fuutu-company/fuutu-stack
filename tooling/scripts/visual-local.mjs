#!/usr/bin/env node
// Local visual-regression report — for teams without CI / GitHub Pages.
//
//   pnpm test:visual:local [--app saas|marketing] [--update] [--native] [--open] [--platform <docker platform>]
//
// Default (Docker): runs the visual specs inside the same Playwright image the
// CI e2e job uses, against a throwaway Postgres on a private Docker network —
// Linux renders that compare against the committed Linux baselines. Never
// touches your dev DB, ports, node_modules or the committed baselines
// (unless --update, which writes Linux baselines exactly like CI would).
// --native: runs on the host against host-platform baselines kept in
// .fuutu/visual-local/native-baselines/<app> (first run establishes them).
//
// Output: .fuutu/visual-report/index.html → <app>/index.html (gitignored).

import { spawn, spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	appPaths,
	isCiBaseline,
	parseArgs,
	playwrightImage,
	playwrightVersion,
} from "./visual-local-lib.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCRIPTS = path.join(ROOT, "tooling", "scripts");
const PG_IMAGE = "postgres:16-alpine"; // same as the CI service
const STORE_VOLUME = "fuutu-visual-pnpm-store";

let opts;
try {
	opts = parseArgs(process.argv.slice(2));
} catch (e) {
	console.error(`${e.message}
Usage: pnpm test:visual:local [--app saas|marketing] [--update] [--native] [--open] [--platform linux/amd64]`);
	process.exit(2);
}

const runInherit = (cmd, args, o = {}) =>
	new Promise((resolve) => {
		const child = spawn(cmd, args, { stdio: "inherit", ...o });
		child.on("exit", (code) => resolve(code ?? 1));
		child.on("error", () => resolve(1));
	});
const run = (cmd, args, o = {}) =>
	spawnSync(cmd, args, { encoding: "utf8", ...o });
const pngs = (dir) =>
	existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")) : [];
const resetDir = (dir) => {
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
};
const copyPngs = (from, to, filter = () => true) => {
	mkdirSync(to, { recursive: true });
	for (const f of pngs(from).filter(filter))
		cpSync(path.join(from, f), path.join(to, f));
};

function buildReport(app, p, label) {
	const r = run(
		"node",
		[
			path.join(SCRIPTS, "visual-report.mjs"),
			"--app",
			app,
			"--out",
			p.reportDir,
			"--expected",
			p.expectedDir,
			"--actual",
			p.actualDir,
			"--local",
			"--label",
			label,
		],
		{ stdio: "inherit", cwd: ROOT },
	);
	if (r.status !== 0) throw new Error(`visual-report failed for ${app}`);
}

// ── Docker mode ───────────────────────────────────────────────────────────────

const dockerCleanup = new Set(); // shell-free [cmd, args] pairs, run on exit
const cleanup = () => {
	for (const args of [...dockerCleanup].reverse())
		run("docker", JSON.parse(args), { stdio: "ignore" });
	dockerCleanup.clear();
};
for (const sig of ["SIGINT", "SIGTERM"]) {
	process.on(sig, () => {
		cleanup();
		process.exit(130);
	});
}
const track = (args) => dockerCleanup.add(JSON.stringify(args));

function dockerOrExit() {
	const r = run("docker", ["info"], { stdio: "ignore" });
	if (r.error || r.status !== 0) {
		console.error(
			"Docker is not available (is the daemon running?). Start Docker, or use --native to run on the host with host-platform baselines.",
		);
		process.exit(1);
	}
}

async function waitForPostgres(container) {
	for (let i = 0; i < 60; i++) {
		const r = run(
			"docker",
			["exec", container, "pg_isready", "-U", "postgres"],
			{ stdio: "ignore" },
		);
		if (r.status === 0) return;
		await new Promise((res) => setTimeout(res, 1000));
	}
	throw new Error("Postgres container did not become ready");
}

async function dockerApp(app, image) {
	const p = appPaths(ROOT, app, "docker");
	resetDir(p.workDir);
	copyPngs(p.committedDir, p.expectedDir, isCiBaseline);
	copyPngs(p.expectedDir, p.actualDir);

	const id = `fuutu-visual-${app}-${process.pid}`;
	const net = `${id}-net`;
	run("docker", ["network", "create", net], { stdio: "ignore" });
	track(["network", "rm", net]);

	const env = [
		`APP=${app}`,
		`HOST_UID=${process.getuid?.() ?? 0}`,
		`HOST_GID=${process.getgid?.() ?? 0}`,
	];
	if (app === "saas") {
		const pg = `${id}-pg`;
		track(["rm", "-f", pg]);
		const r = run("docker", [
			"run",
			"-d",
			"--rm",
			"--name",
			pg,
			"--network",
			net,
			"--network-alias",
			"postgres",
			"-e",
			"POSTGRES_DB=fuutu-stack",
			"-e",
			"POSTGRES_USER=postgres",
			"-e",
			"POSTGRES_PASSWORD=password",
			PG_IMAGE,
		]);
		if (r.status !== 0)
			throw new Error(`could not start Postgres: ${r.stderr}`);
		await waitForPostgres(pg);
		env.push(
			"DATABASE_URL=postgresql://postgres:password@postgres:5432/fuutu-stack",
		);
	}

	track(["rm", "-f", id]);
	console.log(`\n▶ ${app}: running visual specs in ${image}`);
	const code = await runInherit("docker", [
		"run",
		"--rm",
		"--name",
		id,
		"--network",
		net,
		...(opts.platform ? ["--platform", opts.platform] : []),
		"--ipc=host",
		"-v",
		`${ROOT}:/src:ro`,
		"-v",
		`${p.workDir}:/out`,
		"-v",
		`${STORE_VOLUME}:/pnpm-store`,
		...env.flatMap((e) => ["-e", e]),
		image,
		"bash",
		"/src/tooling/scripts/visual-local-container.sh",
	]);
	cleanup();

	let label = `Linux renders (Docker, ${image}) compared with the committed CI baselines in .fuutu/visual-baselines/${app}`;
	if (opts.update) {
		copyPngs(p.actualDir, p.committedDir, isCiBaseline);
		label = `Linux baselines UPDATED in .fuutu/visual-baselines/${app} (${image}) — review the diffs below, then commit them`;
	}
	buildReport(app, p, label);
	return code;
}

// ── Native mode ───────────────────────────────────────────────────────────────

async function nativeApp(app) {
	const p = appPaths(ROOT, app, "native");
	const first = pngs(p.nativeBaselineDir).length === 0;
	resetDir(p.workDir);
	copyPngs(p.nativeBaselineDir, p.expectedDir);
	mkdirSync(p.expectedDir, { recursive: true });
	copyPngs(p.expectedDir, p.actualDir);
	mkdirSync(p.actualDir, { recursive: true });

	console.log(
		`\n▶ ${app}: running visual specs on the host (${process.platform}, chromium)`,
	);
	const code = await runInherit(
		"pnpm",
		[
			"exec",
			"dotenv",
			"-c",
			"--",
			"pnpm",
			"-F",
			`@fuutu/${app}`,
			"exec",
			"playwright",
			"test",
			"tests/visual.spec.ts",
			"--update-snapshots",
			"--project=chromium",
			"--reporter=list",
		],
		{
			cwd: ROOT,
			env: {
				...process.env,
				FUUTU_VISUAL_SNAPSHOT_DIR: p.actualDir,
				FUUTU_TELEMETRY_DISABLED: "1",
			},
		},
	);

	const where = `.fuutu/visual-local/native-baselines/${app}`;
	let label = `HOST baselines (${process.platform}, chromium only) in ${where} — compares with earlier runs on this machine, NOT with the committed Linux/CI baselines`;
	if (first)
		label = `HOST baseline established (${process.platform}, chromium only) in ${where} — nothing to compare yet; run again to diff`;
	else if (opts.update)
		label = `HOST baselines UPDATED (${process.platform}, chromium only) in ${where}`;
	buildReport(app, p, label);

	if (first || opts.update) {
		resetDir(p.nativeBaselineDir);
		copyPngs(p.actualDir, p.nativeBaselineDir);
	}
	return code;
}

// ── Main ──────────────────────────────────────────────────────────────────────

let image = "";
if (!opts.native) {
	dockerOrExit();
	image = playwrightImage(
		playwrightVersion(
			readFileSync(path.join(ROOT, "pnpm-workspace.yaml"), "utf8"),
		),
	);
}

let failed = false;
for (const app of opts.apps) {
	try {
		const code = opts.native
			? await nativeApp(app)
			: await dockerApp(app, image);
		if (code !== 0) {
			failed = true;
			console.error(
				`\n${app}: the test run exited with code ${code} — see the output above (the report shows what was captured).`,
			);
		}
	} catch (e) {
		failed = true;
		cleanup();
		console.error(`\n${app}: ${e.message}`);
	}
}

const reportRoot = appPaths(ROOT, opts.apps[0], "docker").reportRoot;
run(
	"node",
	[path.join(SCRIPTS, "visual-pages-index.mjs"), reportRoot, "--local"],
	{ stdio: "inherit", cwd: ROOT },
);
const indexUrl = pathToFileURL(path.join(reportRoot, "index.html")).href;
console.log(`\nVisual report: ${indexUrl}`);
if (opts.open) {
	const opener =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
				? "cmd"
				: "xdg-open";
	const args =
		process.platform === "win32" ? ["/c", "start", "", indexUrl] : [indexUrl];
	spawn(opener, args, { stdio: "ignore", detached: true }).unref();
}
process.exit(failed ? 1 : 0);
