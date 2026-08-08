import { defineWorkspace } from "vitest/config";

/**
 * Root Vitest workspace — discovers every package/app that ships its own
 * `vitest.config.ts`. `pnpm test` runs them all via turbo; each package can
 * also run `pnpm test` independently.
 */
export default defineWorkspace([
	"packages/*/vitest.config.ts",
	"apps/*/vitest.config.ts",
]);
