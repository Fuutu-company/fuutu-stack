/**
 * Captures the landing page's product screenshots from a running SaaS app
 * into `apps/marketing/public/screens/` — the files listed in
 * `src/modules/marketing/home/components/screens.ts`, at the same size.
 *
 * Point it at the SaaS E2E production server (seeded `<database>-e2e`), not
 * at the dev session — a stale dev build shows stale screens.
 *
 *   # 1. build + start the SaaS E2E server on this slot's e2eSaas port; leave it running
 *   pnpm -F @fuutu/saas exec dotenv -c -e ../../.env -- node ../../tooling/scripts/next.mjs e2e saas
 *   # 2. in a second terminal, from the repo root (Node ≥ 22.18 runs .ts directly)
 *   node --no-warnings apps/marketing/scripts/capture-screens.ts
 *   # 3. stop the server from step 1
 *
 * Options: --base-url <url> (default: this slot's e2eSaas port from
 * .fuutu/project.json) · --email / --password (default: the seeded admin) ·
 * --org <slug> (default: acme) · --locale <code> (default: en) ·
 * --scale <n> device pixel ratio (default: 2) · --out <dir> (default:
 * apps/marketing/public/screens).
 */

import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../..");
/** Keep in sync with `SCREEN_SIZE` in screens.ts. */
const VIEWPORT = { width: 1280, height: 800 };

function slotBaseUrl(): string {
	const project = JSON.parse(
		readFileSync(join(REPO_ROOT, ".fuutu", "project.json"), "utf8"),
	) as { ports: { e2eSaas: number } };
	return `http://localhost:${project.ports.e2eSaas}`;
}

const { values: args } = parseArgs({
	options: {
		"base-url": { type: "string" },
		email: { type: "string", default: "admin@fuutu.local" },
		password: { type: "string", default: "DevPassword!2345" },
		org: { type: "string", default: "acme" },
		locale: { type: "string", default: "en" },
		scale: { type: "string", default: "2" },
		out: { type: "string", default: resolve(HERE, "../public/screens") },
	},
});

const baseUrl = args["base-url"] ?? slotBaseUrl();
const outDir = resolve(args.out);

/** Keep the file names in sync with `SCREENS` in screens.ts. */
const SHOTS = [
	{
		file: "dashboard-light.png",
		path: `/organizations/${args.org}/dashboard`,
		theme: "light",
	},
	{
		file: "dashboard-dark.png",
		path: `/organizations/${args.org}/dashboard`,
		theme: "dark",
	},
	{
		file: "chat.png",
		path: `/organizations/${args.org}/chat`,
		theme: "light",
	},
	{
		file: "team.png",
		path: `/organizations/${args.org}/settings/members`,
		theme: "light",
	},
] as const;

async function main() {
	mkdirSync(outDir, { recursive: true });
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({
			baseURL: baseUrl,
			viewport: VIEWPORT,
			deviceScaleFactor: Number(args.scale),
			locale: args.locale,
		});
		const host = new URL(baseUrl).hostname;
		await context.addCookies([
			{ name: "fuutu.consent.v1", value: "granted", domain: host, path: "/" },
			{ name: "NEXT_LOCALE", value: args.locale, domain: host, path: "/" },
		]);

		const page = await context.newPage();
		await page.goto("/auth/sign-in");
		await page.getByLabel("Email").fill(args.email);
		await page.getByLabel("Password").fill(args.password);
		await page.getByLabel("Password").press("Enter");
		await page.waitForURL(/\/dashboard|\/onboarding/, { timeout: 30_000 });

		for (const shot of SHOTS) {
			await page.evaluate((theme) => {
				localStorage.setItem("theme", theme);
			}, shot.theme);
			await page.goto(shot.path, { waitUntil: "networkidle" });
			await page.evaluate(() => document.fonts.ready);
			await page.screenshot({
				path: join(outDir, shot.file),
				animations: "disabled",
				caret: "hide",
			});
			process.stdout.write(`captured ${shot.file} (${shot.path})\n`);
		}
	} finally {
		await browser.close();
	}
}

main().catch((error: unknown) => {
	process.stderr.write(`capture-screens failed: ${String(error)}\n`);
	process.exit(1);
});
