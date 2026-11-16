import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { excludedTestsConfig } from "../../tooling/scripts/playwright-excluded.mjs";
import { appExcludedTests } from "./tests/app-excluded";

/** This project's port slot (`pnpm ports`) — assigned on first use. */
function localProject(): { ports: Record<string, number> } {
	let root = process.cwd();
	while (!existsSync(join(root, "pnpm-workspace.yaml"))) {
		const up = dirname(root);
		if (up === root) throw new Error("no pnpm workspace above the cwd");
		root = up;
	}
	const file = join(root, ".fuutu", "project.json");
	const read = () =>
		existsSync(file)
			? (JSON.parse(readFileSync(file, "utf8")) as {
					ports: Record<string, number>;
				})
			: null;
	const recorded = read();
	if (recorded?.ports.e2eDocs) return recorded;
	// Missing, or written before the docs E2E port existed — `ensure` keeps
	// the slot and rewrites the file.
	execFileSync("node", ["tooling/scripts/ports.mjs", "ensure"], { cwd: root });
	const project = read();
	if (!project) throw new Error(`no port slot in ${file}`);
	return project;
}

const IS_CI = !!process.env.CI;
const ALL_BROWSERS = IS_CI || process.env.PW_ALL_BROWSERS === "1";
// Local runs get their own server on this project's E2E port (port slots,
// `pnpm ports`) with CI settings — the dev session on the app port stays
// untouched. CI keeps the classic port.
const project = IS_CI ? null : localProject();
const BASE_URL =
	process.env.PLAYWRIGHT_BASE_URL ??
	(project
		? `http://localhost:${project.ports.e2eDocs}`
		: "http://localhost:4000");
const USE_PROD = process.env.PLAYWRIGHT_USE_PROD === "1";

export default defineConfig({
	testDir: "./tests",
	// App-excluded kit specs (`tests/app-excluded.ts`); empty → no change.
	...excludedTestsConfig(appExcludedTests),
	timeout: 30_000,
	expect: {
		timeout: IS_CI ? 15_000 : 5_000,
	},
	fullyParallel: !IS_CI,
	forbidOnly: IS_CI,
	retries: IS_CI ? 2 : 0,
	workers: IS_CI ? 1 : 2,
	reporter: IS_CI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		navigationTimeout: 30_000,
	},
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		...(ALL_BROWSERS
			? [
					{ name: "firefox", use: { ...devices["Desktop Firefox"] } },
					{ name: "webkit", use: { ...devices["Desktop Safari"] } },
					{ name: "mobile-safari", use: { ...devices["iPhone 15"] } },
					{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
				]
			: []),
	],
	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: {
				command: IS_CI
					? USE_PROD
						? "dotenv -c -e ../../.env -- pnpm -F @fuutu/docs start"
						: "dotenv -c -e ../../.env -- pnpm -F @fuutu/docs dev"
					: "dotenv -c -e ../../.env -- node ../../tooling/scripts/next.mjs e2e docs",
				url: BASE_URL,
				reuseExistingServer: !IS_CI,
				// Local E2E servers build once (production mode) before starting.
				timeout: IS_CI ? 60_000 : 300_000,
			},
});
