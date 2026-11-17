import { defineConfig } from "vitest/config";

/**
 * Kit-source guards (`src/arch/kit-source/`): they assert the kit's own
 * demo source and kit-repo files, so they run in the kit repository only
 * (ci.yml), never in `pnpm test`.
 */
export default defineConfig({
	test: {
		globals: false,
		environment: "node",
		include: ["src/arch/kit-source/**/*.test.ts"],
		passWithNoTests: false,
	},
});
