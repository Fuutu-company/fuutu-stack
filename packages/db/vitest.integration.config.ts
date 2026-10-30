import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["src/**/*.integration.test.ts"],
		// Real-DB concurrency tests run actual transactions — allow for
		// lock waits and serialization retries.
		testTimeout: 30_000,
	},
});
