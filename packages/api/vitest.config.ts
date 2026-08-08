import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		passWithNoTests: true,
		testTimeout: 10000,
		hookTimeout: 10000,
		env: {
			DATABASE_URL: "postgresql://fake:fake@localhost:5432/fake",
			BETTER_AUTH_SECRET: "test-secret-for-vitest-at-least-32-chars-long",
			BETTER_AUTH_URL: "http://localhost:3000",
			NODE_ENV: "test",
		},
		setupFiles: ["./vitest.setup.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "json-summary"],
		},
	},
});
