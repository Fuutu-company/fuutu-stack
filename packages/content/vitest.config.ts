import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		passWithNoTests: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
		},
	},
});
