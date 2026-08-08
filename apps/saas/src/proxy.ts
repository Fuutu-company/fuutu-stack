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
	// reason: webhook endpoints are auth-free by design — Polar (and any future
	// payments provider) verify the request via a signed shared-secret header
	// (`Polar-Signature`, HMAC). DO NOT add new bypasses here without a matching
	// signature scheme + smoke test — security: public proxy bypass requires
	// webhook signature validation.
	"/api/webhooks",
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

	const sessionToken = req.cookies.get("better-auth.session_token")?.value;

	// OPTIMISTIC check only — real auth happens in layout via requireAuth().
	if (!sessionToken) {
		const loginUrl = new URL(`${AUTH_PREFIX}/sign-in`, req.url);
		loginUrl.searchParams.set("redirect", pathname);
		return stamp(NextResponse.redirect(loginUrl));
	}

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
	],
};
