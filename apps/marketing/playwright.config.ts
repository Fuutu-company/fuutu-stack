import { defineConfig, devices } from "@playwright/test";

const IS_CI = !!process.env.CI;
const ALL_BROWSERS = IS_CI || process.env.PW_ALL_BROWSERS === "1";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001";
const USE_PROD = process.env.PLAYWRIGHT_USE_PROD === "1";
const COVERAGE = process.env.COVERAGE === "1";

export default defineConfig({
	testDir: "./tests",
	timeout: 30_000,
	...(COVERAGE ? { globalTeardown: "./tests/coverage-teardown.ts" } : {}),
	expect: {
		timeout: IS_CI ? 15_000 : 5_000,
		toHaveScreenshot: {
			maxDiffPixelRatio: 0.02,
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
				command: USE_PROD
					? "dotenv -c -e ../../.env -- pnpm -F @fuutu/marketing start"
					: "dotenv -c -e ../../.env -- pnpm -F @fuutu/marketing dev",
				url: BASE_URL,
				reuseExistingServer: !IS_CI,
				timeout: 60_000,
			},
});
