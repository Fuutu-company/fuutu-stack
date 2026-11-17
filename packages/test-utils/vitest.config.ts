import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["src/**/*.test.ts"],
		// Guards on the kit's own demo source — run via `pnpm test:kit-source`
		// (vitest.kit-source.config.ts), in the kit repository's CI only.
		exclude: ["src/arch/kit-source/**"],
		passWithNoTests: true,
	},
});
