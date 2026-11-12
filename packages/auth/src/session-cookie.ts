import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic "is there a session cookie?" check for `proxy.ts`.
 *
 * Better Auth names the cookie `__Secure-better-auth.session_token` when
 * BETTER_AUTH_URL is https (every production deploy) and
 * `better-auth.session_token` over http (local dev) — this matches both.
 * Edge/proxy-safe: no DB, no auth server import. Not a security boundary;
 * layouts verify the session (`requireAuth()`).
 */
export function hasSessionCookie(request: Request | Headers): boolean {
	return getSessionCookie(request) !== null;
}

// Mirrors API_KEY_PREFIX in @fuutu/db — duplicated so this stays proxy-safe
// (no DB import); guarded by packages/test-utils session-cookie-guard test.
const API_KEY_BEARER_PREFIX = "bearer futu_sk_";

/**
 * Optimistic "is there an API-key credential?" check for `proxy.ts` —
 * `x-api-key` or `Authorization: Bearer futu_sk_…` (the formats
 * `createContext` accepts). Not a security boundary: the API verifies it.
 */
export function hasApiKeyCredential(headers: Headers): boolean {
	if (headers.get("x-api-key") !== null) return true;
	return (
		headers
			.get("authorization")
			?.toLowerCase()
			.startsWith(API_KEY_BEARER_PREFIX) ?? false
	);
}
