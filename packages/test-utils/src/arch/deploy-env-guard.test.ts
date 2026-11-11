import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: build-only env must never reach a runtime image.
 *
 * `SKIP_ENV_VALIDATION` disables `@fuutu/env` validation — at runtime that
 * drops schema defaults (e.g. CORS_ORIGIN → undefined crashes every
 * /api/* route) and lets missing secrets boot silently. Railpack persists
 * step `variables` into the deployed image, so the flag may only appear
 * inline on a build command, and the Dockerfile runner stage must not
 * set it.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const APPS = ["saas", "marketing", "docs"] as const;

type RailpackConfig = {
	steps?: Record<string, { variables?: Record<string, string> }>;
	deploy?: { variables?: Record<string, string> };
};

describe("deploy env guard", () => {
	for (const app of APPS) {
		const railpackPath = join(REPO_ROOT, "apps", app, "railpack.json");
		const dockerfilePath = join(REPO_ROOT, "apps", app, "Dockerfile");

		it(`apps/${app}/railpack.json keeps SKIP_ENV_VALIDATION out of persisted variables`, () => {
			expect(existsSync(railpackPath)).toBe(true);
			const config = JSON.parse(
				readFileSync(railpackPath, "utf8"),
			) as RailpackConfig;
			const persisted = [
				...Object.values(config.steps ?? {}).map((s) => s.variables ?? {}),
				config.deploy?.variables ?? {},
			];
			for (const vars of persisted) {
				expect(vars).not.toHaveProperty("SKIP_ENV_VALIDATION");
			}
		});

		it(`apps/${app}/Dockerfile runner stage does not set SKIP_ENV_VALIDATION`, () => {
			expect(existsSync(dockerfilePath)).toBe(true);
			const source = readFileSync(dockerfilePath, "utf8");
			const runner = source.split(/^FROM .* AS runner$/m)[1];
			expect(runner).toBeDefined();
			expect(runner).not.toMatch(/SKIP_ENV_VALIDATION/);
		});
	}
});
