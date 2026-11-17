import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		passWithNoTests: true,
		// Tests import auth modules inside hooks and tests: slow when `pnpm test`
		// runs every package at once.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
		},
	},
});
