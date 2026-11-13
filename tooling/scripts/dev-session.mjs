#!/usr/bin/env node
/**
 * Live dev session — the apps and ONE visible browser stay up for the whole
 * coding session, so the developer can watch every step the agents take.
 *
 *   pnpm dev:session            start (or reuse) DB, apps and the session browser
 *   pnpm dev:session ensure     same, detached — returns immediately (SessionStart hook)
 *   pnpm dev:session status     what is running
 *   pnpm dev:session stop       stop the apps and close the session browser
 *
 * Ports, database and storage buckets come from this project's port slot
 * (tooling/ports, `pnpm ports`) — every project and every git worktree gets
 * its own set, so sessions of several projects run side by side.
 * The browser is Playwright's Chromium with a persistent profile
 * (.fuutu/browser/session) and remote debugging on the slot's browser port;
 * the Playwright MCP connects to it (tooling/scripts/playwright-mcp.mjs)
 * instead of launching its own. Tabs:
 * Marketing, Docs and SaaS (signed in as the seeded dev admin). Agents open
 * their own tabs and prefix the title with their role, e.g. "[qa] …".
 * Nothing is stopped automatically — `stop` is for the human.
 */
import { spawn, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	ensureSlot,
	findRoot,
	readDotEnv,
	readProject,
	slotEnv,
} from "../ports/index.mjs";

const ROOT = findRoot(dirname(fileURLToPath(import.meta.url)));
const STATE_DIR = join(ROOT, ".fuutu/session");
const PROFILE_DIR = join(ROOT, ".fuutu/browser/session");
const DEV_LOG = join(STATE_DIR, "dev.log");
const PID_FILE = join(STATE_DIR, "dev.pid");

const command = process.argv[2] ?? "start";
const PROJECT =
	command === "start" ? await ensureSlot(ROOT) : readProject(ROOT);
if (!PROJECT && command !== "ensure") {
	process.stdout.write(
		"[dev-session] no port slot yet — run `pnpm dev:session` first\n",
	);
	process.exit(command === "status" ? 0 : 1);
}
if (PROJECT?.notice) process.stdout.write(`[dev-session] ${PROJECT.notice}\n`);
const CDP_PORT = PROJECT?.ports.browser;
const APPS = PROJECT
	? [
			{
				name: "Marketing",
				url: PROJECT.urls.marketing,
				port: PROJECT.ports.marketing,
			},
			{
				name: "Docs",
				url: `${PROJECT.urls.docs}/docs`,
				port: PROJECT.ports.docs,
			},
			{
				name: "SaaS",
				url: `${PROJECT.urls.saas}/dashboard`,
				port: PROJECT.ports.saas,
			},
		]
	: [];
/** Env with this slot's database, URLs and buckets for every child command. */
const ENV = PROJECT
	? (() => {
			const base = { ...readDotEnv(ROOT), ...process.env };
			return { ...base, ...slotEnv(PROJECT, base) };
		})()
	: process.env;
// Seeded dev-only account (packages/db/prisma/seed.ts) — never a real secret.
const LOGIN = {
	email: process.env.FUUTU_SESSION_EMAIL ?? "admin@fuutu.local",
	password: process.env.FUUTU_SESSION_PASSWORD ?? "DevPassword!2345",
};

const log = (msg) => process.stdout.write(`[dev-session] ${msg}\n`);

const portOpen = (port) =>
	new Promise((resolve) => {
		const socket = connect({ port, host: "127.0.0.1" });
		socket.setTimeout(800);
		socket.once("connect", () => {
			socket.destroy();
			resolve(true);
		});
		socket.once("error", () => resolve(false));
		socket.once("timeout", () => {
			socket.destroy();
			resolve(false);
		});
	});

async function waitFor(check, label, timeoutMs = 240_000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await check()) return;
		await new Promise((r) => setTimeout(r, 1000));
	}
	throw new Error(`timed out waiting for ${label}`);
}

const run = (cmd, args, opts = {}) =>
	spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", env: ENV, ...opts })
		.status === 0;

async function ensureDatabase() {
	if (!(await portOpen(5432))) {
		log("starting database (pnpm db:start)");
		run("pnpm", ["db:start"]);
		await waitFor(() => portOpen(5432), "postgres on :5432", 60_000);
	}
	log(`applying migrations to "${PROJECT.database}" (prisma migrate deploy)`);
	if (
		!run("pnpm", [
			"--filter",
			"@fuutu/db",
			"exec",
			"prisma",
			"migrate",
			"deploy",
		])
	) {
		throw new Error(
			"migrate deploy failed — the local DB history does not match prisma/migrations. Fix it yourself (for a throwaway local DB: `pnpm --filter @fuutu/db exec prisma migrate reset`), then rerun.",
		);
	}
}

/** Slot > 0 uses prefixed buckets (s1-avatars …) — create them in local MinIO. */
async function ensureBuckets() {
	const endpoint = ENV.S3_ENDPOINT;
	const buckets = Object.keys(ENV)
		.filter((k) => /^S3_BUCKET_/.test(k) && ENV[k])
		.map((k) => ENV[k]);
	if (
		!PROJECT.storageBucketPrefix ||
		!endpoint ||
		!/localhost|127\.0\.0\.1/.test(endpoint)
	)
		return;
	try {
		const require = createRequire(join(ROOT, "packages/storage/package.json"));
		const {
			S3Client,
			HeadBucketCommand,
			CreateBucketCommand,
		} = require("@aws-sdk/client-s3");
		const s3 = new S3Client({
			endpoint,
			region: ENV.S3_REGION ?? "us-east-1",
			forcePathStyle: true,
			credentials: {
				accessKeyId: ENV.S3_ACCESS_KEY_ID ?? "",
				secretAccessKey: ENV.S3_SECRET_ACCESS_KEY ?? "",
			},
		});
		for (const Bucket of buckets) {
			await s3.send(new HeadBucketCommand({ Bucket })).catch(async () => {
				await s3.send(new CreateBucketCommand({ Bucket }));
				log(`created storage bucket ${Bucket}`);
			});
		}
	} catch (err) {
		log(
			`storage buckets not prepared (${err.message}) — uploads may fail until MinIO runs`,
		);
	}
}

async function ensureApps() {
	const up = await Promise.all(APPS.map((a) => portOpen(a.port)));
	if (up.every(Boolean)) {
		log("apps already running — reusing them");
		return;
	}
	mkdirSync(STATE_DIR, { recursive: true });
	log(`starting apps (pnpm dev) — log: ${DEV_LOG}`);
	const out = openSync(DEV_LOG, "a");
	const child = spawn("pnpm", ["dev"], {
		cwd: ROOT,
		detached: true,
		stdio: ["ignore", out, out],
	});
	child.unref();
	writeFileSync(PID_FILE, String(child.pid));
	for (const app of APPS) {
		await waitFor(() => portOpen(app.port), `${app.name} on :${app.port}`);
	}
}

/**
 * Browser binary for the session: FUUTU_SESSION_BROWSER (path to any
 * Chromium-based browser), else Playwright's Chrome for Testing.
 */
function sessionBrowserPath(chromium) {
	const custom = process.env.FUUTU_SESSION_BROWSER;
	return custom && existsSync(custom) ? custom : chromium.executablePath();
}

function playwright() {
	const require = createRequire(join(ROOT, "apps/saas/package.json"));
	return require("@playwright/test");
}

async function ensureBrowser() {
	const { chromium } = playwright();
	if (!(await portOpen(CDP_PORT))) {
		mkdirSync(PROFILE_DIR, { recursive: true });
		log(`opening the session browser (CDP :${CDP_PORT})`);
		const child = spawn(
			sessionBrowserPath(chromium),
			[
				`--window-name=${PROJECT.name} · slot ${PROJECT.slot}`,
				`--remote-debugging-port=${CDP_PORT}`,
				`--user-data-dir=${PROFILE_DIR}`,
				// Hides the "Chrome for Testing … only for automated testing" bar
				// (CfT honors this for infobars without buttons).
				"--disable-infobars",
				"--no-first-run",
				"--no-default-browser-check",
				"--window-size=1440,960",
				"about:blank",
			],
			{ detached: true, stdio: "ignore" },
		);
		child.unref();
		await waitFor(() => portOpen(CDP_PORT), "session browser", 30_000);
	}

	const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
	const context = browser.contexts()[0];
	const pages = context.pages();
	for (const app of APPS) {
		const origin = new URL(app.url).origin;
		let page = pages.find((p) => p.url().startsWith(origin));
		if (!page) {
			const blank = pages.find((p) => p.url() === "about:blank");
			if (blank) pages.splice(pages.indexOf(blank), 1);
			page = blank ?? (await context.newPage());
			await page.goto(app.url, { waitUntil: "domcontentloaded" });
		}
		if (app.name === "SaaS") await signIn(page, app.url);
	}
	await browser.close(); // disconnects only — the session browser stays open
}

async function signIn(page, dashboardUrl) {
	await page.goto(dashboardUrl, { waitUntil: "domcontentloaded" });
	if (!/\/auth\/sign-in/.test(page.url())) return;
	const attempt = async () => {
		await page.getByLabel("Email").fill(LOGIN.email);
		await page.getByLabel("Password").fill(LOGIN.password);
		await page.getByLabel("Password").press("Enter");
		await page
			.waitForURL((url) => !url.pathname.startsWith("/auth/sign-in"), {
				timeout: 15_000,
			})
			.catch(() => {});
		return !/\/auth\/sign-in/.test(page.url());
	};
	if (await attempt()) return log(`signed in as ${LOGIN.email}`);
	log("sign-in failed — seeding dev accounts (pnpm db:seed) and retrying");
	run("pnpm", ["db:seed"], { env: { ...ENV, NODE_ENV: "development" } });
	await page.goto(dashboardUrl, { waitUntil: "domcontentloaded" });
	if (await attempt()) return log(`signed in as ${LOGIN.email}`);
	log(`could not sign in as ${LOGIN.email} — sign in manually in the SaaS tab`);
}

async function status() {
	log(`${PROJECT.name} · slot ${PROJECT.slot} · database ${PROJECT.database}`);
	for (const app of APPS) {
		log(
			`${app.name.padEnd(9)} ${app.url}  ${(await portOpen(app.port)) ? "up" : "down"}`,
		);
	}
	log(
		`Browser   CDP :${CDP_PORT}  ${(await portOpen(CDP_PORT)) ? "up" : "down"}`,
	);
}

async function stop() {
	if (existsSync(PID_FILE)) {
		const pid = Number(readFileSync(PID_FILE, "utf8"));
		try {
			process.kill(-pid, "SIGTERM");
			log("stopped the apps");
		} catch {
			log("apps were not started by dev:session (or already stopped)");
		}
	}
	if (await portOpen(CDP_PORT)) {
		const { chromium } = playwright();
		const browser = await chromium.connectOverCDP(
			`http://127.0.0.1:${CDP_PORT}`,
		);
		const cdp = await browser.newBrowserCDPSession();
		await cdp.send("Browser.close").catch(() => {});
		log("closed the session browser");
	}
}

async function start() {
	await ensureDatabase();
	await ensureBuckets();
	await ensureApps();
	await ensureBrowser();
	await status();
}

if (command === "ensure") {
	// Opt out per machine/shell with FUUTU_DEV_SESSION=0; never in CI.
	if (process.env.FUUTU_DEV_SESSION === "0" || process.env.CI) process.exit(0);
	// SessionStart hook: never block the agent — run `start` detached.
	mkdirSync(STATE_DIR, { recursive: true });
	const out = openSync(join(STATE_DIR, "ensure.log"), "a");
	spawn(process.execPath, [fileURLToPath(import.meta.url), "start"], {
		cwd: ROOT,
		detached: true,
		stdio: ["ignore", out, out],
	}).unref();
	log("starting in the background — log: .fuutu/session/ensure.log");
	process.exit(0);
}
const commands = { start, status, stop };
if (!commands[command]) {
	log(`unknown command "${command}" — use start | ensure | status | stop`);
	process.exit(1);
}
commands[command]().catch((err) => {
	log(err.message);
	process.exit(1);
});
