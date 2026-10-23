import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["src/**/*.test.ts"],
		// Real-DB tests — run via `pnpm test:integration` (vitest.integration.config.ts)
		exclude: ["**/*.integration.test.ts"],
		passWithNoTests: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
		},
	},
});
