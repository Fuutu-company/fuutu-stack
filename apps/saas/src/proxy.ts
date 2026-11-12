import {
	hasApiKeyCredential,
	hasSessionCookie,
} from "@fuutu/auth/session-cookie";
import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Stamp the kit fingerprint on every NextResponse the proxy returns.
 * This is the third independent emission point (alongside the Hono
 * middleware in `@fuutu/api` and the `headers()` block in
 * `next.config.ts`) so the Fuutu compliance crawler still sees the
 * fingerprint even if a downstream user comments out one of the other
 * two. Removing it is a license violation (LICENSE.md §6(5), §7).
 */
function stamp(response: NextResponse): NextResponse {
	response.headers.set(
		KIT_FINGERPRINT_HEADER_NAME,
		KIT_FINGERPRINT_HEADER_VALUE,
	);
	return response;
}

/**
 * SaaS proxy — optimistic auth check.
 *
 * Every route on this deployment is authenticated EXCEPT the
 * public auth pages, API routes, the image proxy and the root page (which
 * itself redirects based on session).
 *
 * i18n is cookie-based (no URL locale) → no next-intl middleware needed.
 */
/**
 * Public route prefixes that bypass the optimistic session check. We are
 * deliberately narrow here: `/api/auth` covers Better-Auth's own endpoints,
 * `/api/[[...rest]]` (the oRPC mount) handles its own auth via procedures,
 * so we DON'T blanket-skip `/api`.
 */
const PUBLIC_PREFIXES = [
	"/api/auth",
	"/api/health",
	"/api/version",
	// reason: webhook endpoints are auth-free by design — every payments
	// provider (Creem, Stripe, Polar, custom) is verified by its signed
	// shared-secret header (HMAC) inside handlePaymentsWebhook. DO NOT add new bypasses here without a matching
	// signature scheme + smoke test — security: public proxy bypass requires
	// webhook signature validation.
	"/api/webhooks",
	// reason: OpenAPI docs are public by design — developers need to explore
	// the API without authentication. The oRPC handler itself gates procedures
	// via protectedProcedure where needed.
	"/api/docs",
	"/api/spec.json",
	// reason: cron trigger endpoint — schedulers authenticate via
	// `Authorization: Bearer ${CRON_SECRET}` (shared secret), not a session
	// cookie. The Hono route returns 501 when the secret is unset.
	"/api/cron",
	// reason: MCP endpoint — clients authenticate per request with an org
	// API key (`Authorization: Bearer`, `mcp` scope) or an OAuth access token,
	// both verified by resolveMcpPrincipal; anonymous callers only reach
	// `public` tools.
	"/api/mcp",
	// reason: OAuth discovery documents (RFC 8414 authorization-server and
	// RFC 9728 protected-resource metadata) are public by spec — MCP clients
	// fetch them before they hold any credential. Read-only JSON, no secrets.
	"/.well-known",
	"/auth",
	"/image-proxy",
] as const;
const AUTH_PREFIX = "/auth";

function isPublic(pathname: string): boolean {
	if (pathname === "/") return true;
	return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Forward pathname so server components / layouts can branch on it
	// (e.g. the onboarding gate in `requireOnboarded`).
	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-pathname", pathname);

	if (isPublic(pathname)) {
		return stamp(NextResponse.next({ request: { headers: requestHeaders } }));
	}

	// Matches `__Secure-better-auth.session_token` (https) and the plain name.
	const hasSession = hasSessionCookie(req);

	// API-key requests carry no session cookie — they authenticate in the oRPC
	// context via `x-api-key` or `Authorization: Bearer futu_sk_…` (verifyApiKey → owner session, org pinning
	// fail-closed). The optimistic cookie check must not bounce them.
	const hasApiKey = hasApiKeyCredential(req.headers);

	// OPTIMISTIC check only — real auth happens in layout via requireAuth().
	if (!hasSession && !hasApiKey) {
		const loginUrl = new URL(`${AUTH_PREFIX}/sign-in`, req.url);
		loginUrl.searchParams.set("redirect", pathname);
		return stamp(NextResponse.redirect(loginUrl));
	}

	// Forced-mode org enforcement lives in `requireOrg()` ((app) layout):
	// it needs a DB membership count — a cookie can't distinguish "member
	// with no active org" from "no memberships", so an optimistic check
	// here would redirect valid members. Proxy stays auth-only.
	return stamp(NextResponse.next({ request: { headers: requestHeaders } }));
}

// Default export for Next.js
export default proxy;

/**
 * Matcher configuration - exclude static assets and Next.js internals
 */
export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
		"/api/:path*",
	],
};
