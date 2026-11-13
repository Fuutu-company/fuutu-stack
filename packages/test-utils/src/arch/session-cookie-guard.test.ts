import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard test: proxies must detect the session cookie via
 * `hasSessionCookie` (@fuutu/auth/session-cookie). Reading
 * `better-auth.session_token` by name misses the `__Secure-` prefixed
 * cookie Better Auth sets over https — every signed-in user would be
 * bounced to sign-in in production.
 */

const REPO_ROOT = join(import.meta.dirname, "../../../../");

describe("session cookie guard", () => {
	it("the proxy-safe API-key prefix matches API_KEY_PREFIX in @fuutu/db", () => {
		const db = readFileSync(
			join(REPO_ROOT, "packages", "db", "prisma", "queries", "api-key.ts"),
			"utf8",
		);
		const auth = readFileSync(
			join(REPO_ROOT, "packages", "auth", "src", "session-cookie.ts"),
			"utf8",
		);
		const prefix = /API_KEY_PREFIX = "([^"]+)"/.exec(db)?.[1];
		expect(prefix).toBeDefined();
		expect(auth).toContain(`"bearer ${prefix}"`);
	});

	it("apps/saas/src/proxy.ts uses hasSessionCookie, not the raw cookie name", () => {
		const source = readFileSync(
			join(REPO_ROOT, "apps", "saas", "src", "proxy.ts"),
			"utf8",
		);
		expect(source).toContain("hasSessionCookie(");
		expect(source).not.toMatch(
			/cookies\.get\(\s*["']better-auth\.session_token/,
		);
	});
});
