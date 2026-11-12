import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: every `/api/*` request in apps/saas goes through the Hono app
 * (`app/api/[[...rest]]/route.ts`). A more specific Next route would win
 * over the catch-all and silently bypass Hono's middleware (CSRF origin
 * guard, CORS, fingerprint, request log) — the payments webhook used to be
 * mounted twice this way.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");
const API_DIR = join(REPO_ROOT, "apps", "saas", "src", "app", "api");

function routeFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) return routeFiles(path);
		return /^route\.(ts|tsx)$/.test(entry) ? [path] : [];
	});
}

describe("single API entry guard", () => {
	it("apps/saas/src/app/api only contains the Hono catch-all route", () => {
		const routes = routeFiles(API_DIR).map((f) => relative(API_DIR, f));
		expect(routes).toEqual(["[[...rest]]/route.ts"]);
	});
});
