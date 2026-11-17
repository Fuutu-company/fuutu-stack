import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["src/**/*.test.ts"],
		// Guards import app modules and scan the repo inside tests: slow when
		// `pnpm test` runs every package at once.
		testTimeout: 30_000,
		hookTimeout: 30_000,
		// Guards on the kit's own demo source — run via `pnpm test:kit-source`
		// (vitest.kit-source.config.ts), in the kit repository's CI only.
		exclude: ["src/arch/kit-source/**"],
		passWithNoTests: true,
	},
});
