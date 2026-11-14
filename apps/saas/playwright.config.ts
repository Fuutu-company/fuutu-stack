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
	if (!existsSync(file)) {
		execFileSync("node", ["tooling/scripts/ports.mjs", "ensure"], {
			cwd: root,
		});
	}
	return JSON.parse(readFileSync(file, "utf8"));
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
		? `http://localhost:${project.ports.e2eSaas}`
		: "http://localhost:3000");
const USE_PROD = process.env.PLAYWRIGHT_USE_PROD === "1";

export default defineConfig({
	testDir: "./tests",
	// App-excluded kit specs (`tests/app-excluded.ts`); empty → no change.
	...excludedTestsConfig(appExcludedTests),
	// Baselines are committed to the repo (.fuutu/visual-baselines/<app>) —
	// CI regenerates + auto-commits them on merge to develop/main.
	// `pnpm test:visual:local` points this at a scratch dir so committed baselines stay untouched.
	snapshotDir:
		process.env.FUUTU_VISUAL_SNAPSHOT_DIR ??
		"../../.fuutu/visual-baselines/saas",
	snapshotPathTemplate: "{snapshotDir}/{arg}-{projectName}-{platform}{ext}",
	timeout: 45_000,
	expect: {
		timeout: IS_CI ? 15_000 : 5_000,
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.005,
			animations: "disabled",
		},
	},
	fullyParallel: !IS_CI,
	forbidOnly: IS_CI,
	retries: IS_CI ? 2 : 0,
	workers: IS_CI ? 1 : 2,
	reporter: IS_CI ? [["github"], ["html", { open: "never" }]] : "list",
	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
		video: "retain-on-failure",
		screenshot: "only-on-failure",
		navigationTimeout: 30_000,
	},
	projects: [
		{
			name: "setup",
			testMatch: /global\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: "tests/.auth/user.json",
			},
			dependencies: ["setup"],
		},
		...(ALL_BROWSERS
			? [
					{
						name: "firefox",
						use: {
							...devices["Desktop Firefox"],
							storageState: "tests/.auth/user.json",
						},
						dependencies: ["setup"],
					},
					{
						name: "webkit",
						use: {
							...devices["Desktop Safari"],
							storageState: "tests/.auth/user.json",
						},
						dependencies: ["setup"],
					},
					{
						name: "mobile-safari",
						use: {
							...devices["iPhone 15"],
							storageState: "tests/.auth/user.json",
						},
						dependencies: ["setup"],
					},
					{
						name: "mobile-chrome",
						use: {
							...devices["Pixel 7"],
							storageState: "tests/.auth/user.json",
						},
						dependencies: ["setup"],
					},
				]
			: []),
	],
	webServer: process.env.PLAYWRIGHT_BASE_URL
		? undefined
		: {
				command: IS_CI
					? USE_PROD
						? "dotenv -c -e ../../.env -- pnpm -F @fuutu/saas start"
						: "dotenv -c -e ../../.env -- pnpm -F @fuutu/saas dev"
					: "dotenv -c -e ../../.env -- node ../../tooling/scripts/next.mjs e2e saas",
				url: BASE_URL,
				reuseExistingServer: !IS_CI,
				// Local E2E servers build once (production mode) before starting.
				timeout: IS_CI ? 60_000 : 300_000,
			},
});
