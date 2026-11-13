import { env } from "@fuutu/env/public";
import { getSafeRedirect as safeRedirect } from "@fuutu/utils/redirect";
import { authConfig } from "./config";

/**
 * Auth-scoped wrapper around the canonical `@fuutu/utils/redirect` helper.
 * Supplies the auth-specific fallback (`afterSignIn`) and the
 * same-origin allow-list derived from `env.NEXT_PUBLIC_SAAS_URL`.
 *
 * Prefer this helper inside `apps/saas/src/modules/auth/*` so the fallback
 * stays consistent. For non-auth flows call `@fuutu/utils/redirect` directly
 * with your own `fallback`.
 */
function getAllowedOrigins(): string[] {
	return [env.NEXT_PUBLIC_SAAS_URL].filter((origin): origin is string =>
		Boolean(origin),
	);
}

export function getSafeRedirect(redirect: string | null | undefined): string {
	return safeRedirect(redirect, {
		fallback: authConfig.redirects.afterSignIn,
		allowedOrigins: getAllowedOrigins(),
	});
}

/**
 * Where the email-verification link lands (`callbackURL` of the sign-up
 * request): an explicit safe target such as an invitation link, else
 * `authConfig.redirects.afterEmailVerification`.
 */
export function getEmailVerificationRedirect(
	redirect: string | null | undefined,
): string {
	return safeRedirect(redirect, {
		fallback: authConfig.redirects.afterEmailVerification,
		allowedOrigins: getAllowedOrigins(),
	});
}

/**
 * Invitation-bound sign-up helper: returns the invitation id when the
 * redirect target is the accept-invitation page, else null.
 *
 * Always pass the SANITIZED target (`getSafeRedirect` output) — parsing
 * the raw `redirect` param would forward an invitation id from a URL the
 * sanitizer rejected (e.g. an external `https://evil/auth/accept-invitation?id=x`
 * that falls back to the default redirect).
 */
export function extractInvitationId(
	redirectTo: string | null | undefined,
): string | null {
	if (!redirectTo) return null;
	try {
		const url = new URL(redirectTo, "http://localhost");
		return url.pathname.replace(/\/$/, "") === "/auth/accept-invitation"
			? url.searchParams.get("id")
			: null;
	} catch {
		return null;
	}
}

/** Entry pages a signed-in visitor is bounced away from — never a target. */
const AUTH_ENTRY_PATHS = new Set(["/auth/sign-in", "/auth/sign-up"]);

/** Decoded pathname without duplicate or trailing slashes; null if malformed. */
function normalizePathname(pathname: string): string | null {
	try {
		return decodeURIComponent(pathname)
			.replace(/\/{2,}/g, "/")
			.replace(/\/+$/, "");
	} catch {
		return null;
	}
}

/**
 * Where a signed-in visitor of sign-in / sign-up goes: the `redirect` param
 * when it is safe, else `authConfig.redirects.afterSignIn` (also when the
 * param points back at sign-in / sign-up, which would loop). `null` keeps
 * the page: a signed OAuth authorization request (`sig`) — the MCP
 * authorization server sends signed-in users there for `prompt=login` /
 * `prompt=create`.
 */
export function getSignedInRedirect(
	params: Record<string, string | string[] | undefined>,
): string | null {
	if (params.sig !== undefined) return null;
	const raw = typeof params.redirect === "string" ? params.redirect : null;
	const target = getSafeRedirect(raw);
	const { pathname } = new URL(target, "http://localhost");
	const normalized = normalizePathname(pathname);
	return normalized === null || AUTH_ENTRY_PATHS.has(normalized)
		? getSafeRedirect(null)
		: target;
}
