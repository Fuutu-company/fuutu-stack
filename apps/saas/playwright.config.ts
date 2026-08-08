import { defineConfig, devices } from "@playwright/test";

const IS_CI = !!process.env.CI;
const ALL_BROWSERS = IS_CI || process.env.PW_ALL_BROWSERS === "1";
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const USE_PROD = process.env.PLAYWRIGHT_USE_PROD === "1";

export default defineConfig({
	testDir: "./tests",
	timeout: 45_000,
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
				command: USE_PROD
					? "dotenv -c -e ../../.env -- pnpm -F @fuutu/saas start"
					: "dotenv -c -e ../../.env -- pnpm -F @fuutu/saas dev",
				url: BASE_URL,
				reuseExistingServer: !IS_CI,
				timeout: 60_000,
			},
});
